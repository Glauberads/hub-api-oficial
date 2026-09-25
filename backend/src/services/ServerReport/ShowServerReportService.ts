import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type HealthStatus = "online" | "available" | "warning" | "critical" | "offline" | "unknown";

interface ServiceStatus {
  key: string;
  name: string;
  description: string;
  status: HealthStatus;
  detail?: string;
  pid?: number | null;
  uptime?: string | null;
  memory?: string | null;
  cpu?: string | null;
}

const runCommand = async (command: string): Promise<string> => {
  try {
    const { stdout } = await execAsync(command, {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });

    return String(stdout || "").trim();
  } catch (error) {
    return "";
  }
};

const fileExists = async (relativePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(path.resolve(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
};

const readJsonFile = async (relativePath: string): Promise<any> => {
  try {
    const content = await fs.promises.readFile(path.resolve(process.cwd(), relativePath), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const bytesToGB = (bytes: number): number => {
  return Math.round((bytes / 1024 / 1024 / 1024) * 100) / 100;
};

const bytesToMB = (bytes: number): number => {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
};

const formatDuration = (secondsInput: number): string => {
  const seconds = Math.max(0, Math.floor(secondsInput || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const percentStatus = (percent: number, warning = 75, critical = 90): HealthStatus => {
  if (!Number.isFinite(percent)) return "unknown";
  if (percent >= critical) return "critical";
  if (percent >= warning) return "warning";
  return "online";
};

const getDiskInfo = async () => {
  const output = await runCommand("df -Pk / | tail -1");

  if (!output) {
    return {
      totalGB: 0,
      usedGB: 0,
      freeGB: 0,
      percent: 0,
      status: "unknown" as HealthStatus,
      mount: "/"
    };
  }

  const parts = output.split(/\s+/);
  const totalKB = Number(parts[1] || 0);
  const usedKB = Number(parts[2] || 0);
  const freeKB = Number(parts[3] || 0);
  const percent = Number(String(parts[4] || "0").replace("%", ""));
  const mount = parts[5] || "/";

  return {
    totalGB: Math.round((totalKB / 1024 / 1024) * 100) / 100,
    usedGB: Math.round((usedKB / 1024 / 1024) * 100) / 100,
    freeGB: Math.round((freeKB / 1024 / 1024) * 100) / 100,
    percent,
    status: percentStatus(percent),
    mount
  };
};

const getPm2Processes = async (): Promise<any[]> => {
  const output = await runCommand("bash -lc 'pm2 jlist'");

  if (!output) return [];

  try {
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getPm2Service = (
  processes: any[],
  key: string,
  name: string,
  description: string,
  patterns: string[]
): ServiceStatus => {
  const found = processes.find(processItem => {
    const processName = String(processItem?.name || "").toLowerCase();
    return patterns.some(pattern => processName.includes(pattern.toLowerCase()));
  });

  if (!found) {
    return {
      key,
      name,
      description,
      status: "unknown",
      detail: "Processo não encontrado no PM2"
    };
  }

  const status = found?.pm2_env?.status === "online" ? "online" : "offline";
  const uptimeMs = found?.pm2_env?.pm_uptime
    ? Date.now() - Number(found.pm2_env.pm_uptime)
    : 0;

  return {
    key,
    name,
    description,
    status,
    detail: found?.pm2_env?.status || "desconhecido",
    pid: found?.pid || null,
    uptime: uptimeMs > 0 ? formatDuration(uptimeMs / 1000) : null,
    memory: Number.isFinite(found?.monit?.memory) ? `${bytesToMB(found.monit.memory)} MB` : null,
    cpu: Number.isFinite(found?.monit?.cpu) ? `${found.monit.cpu}%` : null
  };
};

const getCommandService = async (
  key: string,
  name: string,
  description: string,
  command: string
): Promise<ServiceStatus> => {
  const output = await runCommand(command);
  const normalized = output.toLowerCase();

  const online =
    normalized.includes("online") ||
    normalized.includes("active") ||
    normalized.includes("pong") ||
    normalized.includes("accepting connections");

  return {
    key,
    name,
    description,
    status: online ? "online" : "offline",
    detail: output || "Sem resposta"
  };
};


const getRedisService = async (): Promise<ServiceStatus> => {
  const pingOutput = await runCommand("(redis-cli ping 2>&1 || true)");
  const normalizedPing = pingOutput.toLowerCase();

  if (normalizedPing.includes("pong")) {
    return {
      key: "redis",
      name: "Redis",
      description: "Cache, filas, socket adapter e recursos em tempo real.",
      status: "online",
      detail: "PONG"
    };
  }

  if (
    normalizedPing.includes("noauth") ||
    normalizedPing.includes("authentication required") ||
    normalizedPing.includes("denied")
  ) {
    const serviceOutput = await runCommand("(systemctl is-active redis-server 2>/dev/null || systemctl is-active redis 2>/dev/null || true)");

    return {
      key: "redis",
      name: "Redis",
      description: "Cache, filas, socket adapter e recursos em tempo real.",
      status: serviceOutput.toLowerCase().includes("active") ? "online" : "warning",
      detail: serviceOutput.toLowerCase().includes("active")
        ? "active - autenticação habilitada"
        : "Redis respondeu, mas exige autenticação"
    };
  }

  const serviceOutput = await runCommand("(systemctl is-active redis-server 2>/dev/null || systemctl is-active redis 2>/dev/null || true)");

  return {
    key: "redis",
    name: "Redis",
    description: "Cache, filas, socket adapter e recursos em tempo real.",
    status: serviceOutput.toLowerCase().includes("active") ? "online" : "offline",
    detail: pingOutput || serviceOutput || "Sem resposta"
  };
};

const checkFeature = async (
  key: string,
  name: string,
  description: string,
  files: string[],
  envKeys: string[] = []
) => {
  const fileChecks = await Promise.all(files.map(fileExists));
  const hasFile = fileChecks.some(Boolean);
  const hasEnv = envKeys.some(envKey => Boolean(process.env[envKey]));

  return {
    key,
    name,
    description,
    status: hasFile || hasEnv ? "available" : "unknown",
    detail: hasEnv
      ? "Configurado no ambiente"
      : hasFile
        ? "Módulo encontrado no código"
        : "Não identificado automaticamente"
  };
};

const buildOverallStatus = (items: Array<{ status: HealthStatus }>) => {
  const hasCritical = items.some(item => item.status === "critical" || item.status === "offline");
  const hasWarning = items.some(item => item.status === "warning" || item.status === "unknown");

  if (hasCritical) {
    return {
      status: "critical" as HealthStatus,
      label: "Atenção crítica",
      message: "Um ou mais serviços importantes precisam de verificação."
    };
  }

  if (hasWarning) {
    return {
      status: "warning" as HealthStatus,
      label: "Atenção",
      message: "O sistema está online, mas existem pontos para acompanhar."
    };
  }

  return {
    status: "online" as HealthStatus,
    label: "Sistema saudável",
    message: "Todos os principais indicadores estão operando normalmente."
  };
};

const ShowServerReportService = async () => {
  const cpus = os.cpus() || [];
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryPercent = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;
  const loadAverage = os.loadavg();
  const cpuLoadPercent = cpus.length > 0
    ? Math.min(100, Math.round((loadAverage[0] / cpus.length) * 100))
    : 0;

  const [disk, osPrettyName, packageJson, pm2Processes] = await Promise.all([
    getDiskInfo(),
    runCommand("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2- | tr -d '\"'"),
    readJsonFile("package.json"),
    getPm2Processes()
  ]);

  const pm2Services: ServiceStatus[] = [
    getPm2Service(
      pm2Processes,
      "backend",
      "Backend do sistema",
      "API principal, autenticação, tickets, mensagens e integrações.",
      ["empresa01-backend", "backend"]
    ),
    getPm2Service(
      pm2Processes,
      "frontend",
      "Frontend do sistema",
      "Interface web do painel administrativo e atendimento.",
      ["empresa01-frontend", "frontend"]
    ),
    getPm2Service(
      pm2Processes,
      "officialApi",
      "API Oficial",
      "Serviço dedicado para WhatsApp Cloud API / Meta.",
      ["api_oficial", "oficial", "official"]
    ),
    getPm2Service(
      pm2Processes,
      "transcription",
      "Transcrição",
      "Serviço auxiliar para transcrição e processamento de áudio.",
      ["empresa01-transcricao", "transcricao", "transcription"]
    )
  ];

  const infrastructureServices = await Promise.all([
    getCommandService(
      "postgres",
      "PostgreSQL",
      "Banco de dados principal do sistema.",
      "(pg_isready -h localhost 2>/dev/null || true)"
    ),
    getRedisService(),
    getCommandService(
      "nginx",
      "Nginx",
      "Proxy reverso e publicação HTTPS dos serviços.",
      "(systemctl is-active nginx 2>/dev/null || true)"
    ),
    getCommandService(
      "pm2",
      "PM2",
      "Gerenciador dos processos Node.js.",
      "(pm2 ping 2>/dev/null || true)"
    )
  ]);

  const features = await Promise.all([
    checkFeature(
      "followup",
      "Follow-up",
      "Agendamentos, lembretes e continuidade comercial.",
      ["src/routes/ScheduledMessagesRoutes.ts", "src/routes/scheduleRoutes.ts"]
    ),
    checkFeature(
      "officialApi",
      "API Oficial",
      "WhatsApp Oficial, templates, mídia e janela de atendimento.",
      ["src/services/WhatsAppOficial", "src/routes/embeddedSignupRoutes.ts"],
      ["URL_API_OFICIAL"]
    ),
    checkFeature(
      "warmup",
      "Aquecimento de Chips",
      "Módulo para aquecimento e preparação de conexões.",
      ["src/routes/warmupRoutes.ts"]
    ),
    checkFeature(
      "emailMarketing",
      "E-mail Marketing",
      "Configurações, eventos e estrutura para envio de e-mails.",
      ["src/routes/emailSettingRoutes.ts", "src/controllers/SendGridWebhookController.ts"]
    ),
    checkFeature(
      "wavoip",
      "Wavoip",
      "Chamadas, histórico e telefonia integrada.",
      ["src/routes/callRoutes.ts"]
    ),
    checkFeature(
      "landingPages",
      "Landing Pages",
      "Captação de leads por formulários, WordPress e Elementor.",
      [
        "src/routes/landingWebhookConfigRoutes.ts",
        "src/routes/landingWebhookPublicRoutes.ts",
        "src/routes/landingWebhookLogRoutes.ts"
      ]
    ),
    checkFeature(
      "flowbuilder",
      "Flowbuilder",
      "Fluxos, automações e campanhas visuais.",
      ["src/routes/flowBuilderRoutes.ts", "src/routes/flowDefaultRoutes.ts", "src/routes/flowCampaignRoutes.ts"]
    ),
    checkFeature(
      "asaas",
      "Asaas / Boletos",
      "Consulta de cobranças e segunda via de boletos.",
      ["src/routes/asaasRoutes.ts"]
    ),
    checkFeature(
      "radar",
      "Radar de Oportunidades",
      "Análise inteligente de conversas e sugestões comerciais.",
      ["src/routes/aiSuggestionRoutes.ts"]
    ),
    checkFeature(
      "campaigns",
      "Campanhas",
      "Disparos, listas, relatórios e configuração de campanhas.",
      ["src/routes/campaignRoutes.ts", "src/routes/campaignSettingRoutes.ts", "src/routes/flowCampaignRoutes.ts"]
    )
  ]);

  const resourceItems = [
    { status: percentStatus(cpuLoadPercent) },
    { status: percentStatus(memoryPercent) },
    { status: disk.status }
  ];

  const overall = buildOverallStatus([
    ...resourceItems,
    ...pm2Services,
    ...infrastructureServices
  ]);

  return {
    generatedAt: new Date().toISOString(),
    product: {
      name: "MULTIATENDIMENTO",
      description: "Painel de saúde do sistema, integrações e infraestrutura.",
      version: packageJson?.version || "não informado",
      environment: process.env.NODE_ENV || "production"
    },
    overall,
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      os: osPrettyName || `${os.type()} ${os.release()}`,
      uptime: formatDuration(os.uptime()),
      backendUptime: formatDuration(process.uptime()),
      cpu: {
        model: cpus[0]?.model || "CPU não identificada",
        cores: cpus.length,
        loadAverage,
        percent: cpuLoadPercent,
        status: percentStatus(cpuLoadPercent)
      },
      memory: {
        totalGB: bytesToGB(totalMemory),
        usedGB: bytesToGB(usedMemory),
        freeGB: bytesToGB(freeMemory),
        percent: memoryPercent,
        status: percentStatus(memoryPercent)
      },
      disk,
      runtime: {
        node: process.version,
        pid: process.pid,
        cwd: process.cwd()
      }
    },
    services: {
      pm2: pm2Services,
      infrastructure: infrastructureServices
    },
    features
  };
};

export default ShowServerReportService;
