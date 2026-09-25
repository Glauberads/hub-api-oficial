import { Request, Response } from "express";
import WarmupConnection from "../models/WarmupConnection";
import {
    initWarmupSession,
    getWarmupPool,
    removeWarmupSessionFromPool
} from "../services/WarmupSessionService";
import {
    startWarmupCluster,
    stopWarmupCluster,
    getWarmupClusterStatus
} from "../services/WarmupClusterService";
import {
    getWarmupConfig,
    updateWarmupConfig
} from "../services/WarmupConfigService";

class WarmupConnectionController {
    public async store(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;

        const { name, number, warmupGroup = "default" } = req.body;

        const connection = await WarmupConnection.create({
            name,
            number,
            companyId,
            session: `warmup_${companyId}_${Date.now()}`,
            status: "PENDING",
            warmupGroup,
            isActive: true
        });

        const qrCode = await initWarmupSession(connection.id, connection.session);

        await connection.update({
            status: qrCode ? "QRCODE" : "CONNECTED"
        });

        return res.status(201).json({ connection, qrCode });
    }

    public async connect(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;
        const { id } = req.params;

        const connection = await WarmupConnection.findOne({
            where: { id, companyId }
        });

        if (!connection) {
            return res.status(404).json({ error: "Warmup connection not found" });
        }

        const qrCode = await initWarmupSession(connection.id, connection.session);

        await connection.update({
            status: qrCode ? "QRCODE" : "CONNECTED"
        });

        return res.json({ connection, qrCode });
    }

    public async getConfig(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;
        const config = await getWarmupConfig(companyId);
        return res.json(config);
    }

    public async updateConfig(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;
        const config = await updateWarmupConfig(companyId, req.body);
        return res.json(config);
    }

    public async toggle(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;
        const config = await getWarmupConfig(companyId);

        await config.update({
            isActive: !config.isActive
        });

        return res.json(config);
    }

    public async index(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;

        const connections = await WarmupConnection.findAll({
            where: { companyId },
            order: [["id", "DESC"]]
        });

        const pool = getWarmupPool();

        return res.json({
            connections,
            online: pool
                .filter(item => item.companyId === companyId)
                .map(item => ({
                    id: item.id,
                    sessionId: item.sessionId,
                    number: item.number
                }))
        });
    }

    public async delete(req: Request, res: Response): Promise<Response> {
        const { companyId } = req.user;
        const { id } = req.params;

        const connection = await WarmupConnection.findOne({
            where: { id, companyId }
        });

        if (!connection) {
            return res.status(404).json({ error: "Warmup connection not found" });
        }

        removeWarmupSessionFromPool(connection.session);
        await connection.destroy();

        return res.json({ message: "Warmup connection removed" });
    }

    public async start(req: Request, res: Response): Promise<Response> {
        await startWarmupCluster();

        return res.json({
            message: "Warmup cluster iniciado",
            status: getWarmupClusterStatus()
        });
    }

    public async stop(req: Request, res: Response): Promise<Response> {
        stopWarmupCluster();

        return res.json({
            message: "Warmup cluster parado",
            status: getWarmupClusterStatus()
        });
    }

    public async status(req: Request, res: Response): Promise<Response> {
        return res.json(getWarmupClusterStatus());
    }
}

export default new WarmupConnectionController();