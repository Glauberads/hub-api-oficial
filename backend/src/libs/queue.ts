import "dotenv/config";
import BullQueue from "bull";
import { REDIS_URI_MSG_CONN } from "../config/redis";
import configLoader from "../services/ConfigLoaderService/configLoaderService";
import * as jobs from "../jobs";
import logger from "../utils/logger";

const config = configLoader();

const processRole = String(process.env.PROCESS_ROLE || "all").toLowerCase();
const shouldProcessQueues = processRole === "all" || processRole === "worker";

const queueOptions = {
  defaultJobOptions: {
    attempts: config.webhook.attempts,
    backoff: {
      type: config.webhook.backoff.type,
      delay: config.webhook.backoff.delay
    },
    removeOnFail: false,
    removeOnComplete: true
  },
  limiter: {
    max: config.webhook.limiter.max,
    duration: config.webhook.limiter.duration
  }
};

type JobHandler = (job: any) => Promise<any> | any;

interface JobDefinition {
  key: string;
  handle: JobHandler;
  concurrency?: number;
}

interface QueueItem {
  bull: BullQueue.Queue<any>;
  name: string;
  handle: JobHandler;
  concurrency: number;
  listenersBound?: boolean;
  processorStarted?: boolean;
}

const jobDefinitions = Object.values(jobs).filter(
  (job): job is JobDefinition =>
    !!job &&
    typeof job === "object" &&
    "key" in job &&
    "handle" in job &&
    typeof (job as any).key === "string" &&
    typeof (job as any).handle === "function"
);

const queues: QueueItem[] = jobDefinitions.reduce((acc: QueueItem[], job) => {
  acc.push({
    bull: new BullQueue(job.key, REDIS_URI_MSG_CONN, queueOptions),
    name: job.key,
    handle: job.handle,
    concurrency: Number(job.concurrency || 1),
    listenersBound: false,
    processorStarted: false
  });

  return acc;
}, []);

const bindQueueListeners = (queue: QueueItem): void => {
  if (queue.listenersBound) {
    return;
  }

  queue.bull.on("failed", (job, err) => {
    logger.error(
      `[BULL] Job failed: ${queue.name} | id=${job?.id} | data=${JSON.stringify(job?.data || {})}`
    );
    logger.error(err);
  });

  queue.bull.on("error", err => {
    logger.error(`[BULL] Queue error: ${queue.name}`);
    logger.error(err);
  });

  queue.listenersBound = true;
};

export default {
  queues,

  getQueue(name: string): QueueItem {
    const queue = this.queues.find(queueItem => queueItem.name === name);

    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }

    return queue;
  },

  add(name: string, data: any, params: Record<string, any> = {}) {
    const queue = this.getQueue(name);

    return queue.bull.add(data, {
      ...params,
      removeOnComplete:
        typeof params.removeOnComplete === "undefined" ? true : params.removeOnComplete
    });
  },

  process() {
    if (!shouldProcessQueues) {
      logger.info(
        `[BULL] Queue processors skipped for PROCESS_ROLE=${processRole}`
      );
      return;
    }

    this.queues.forEach(queue => {
      bindQueueListeners(queue);

      if (queue.processorStarted) {
        logger.warn(`[BULL] Queue processor already started: ${queue.name}`);
        return;
      }

      queue.bull.process(queue.concurrency, queue.handle);
      queue.processorStarted = true;

      logger.info(
        `[BULL] Queue processor started: ${queue.name} | concurrency=${queue.concurrency}`
      );
    });
  }
};