import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import { AuthContext } from "../../context/Auth/AuthContext";
import { socketConnection } from "../../services/socket";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    borderRadius: 14,
    overflow: "hidden"
  },
  header: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(2)
  },
  pulse: {
    width: 78,
    height: 78,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 38,
    margin: "0 auto",
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    animation: "$pulse 1.2s infinite"
  },
  "@keyframes pulse": {
    "0%": {
      transform: "scale(1)",
      boxShadow: "0 0 0 0 rgba(0,0,0,0.28)"
    },
    "70%": {
      transform: "scale(1.04)",
      boxShadow: "0 0 0 14px rgba(0,0,0,0)"
    },
    "100%": {
      transform: "scale(1)",
      boxShadow: "0 0 0 0 rgba(0,0,0,0)"
    }
  },
  infoBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 10,
    background: theme.palette.background.default
  },
  number: {
    fontWeight: 700,
    fontSize: 18,
    wordBreak: "break-word"
  },
  actions: {
    padding: theme.spacing(2),
    justifyContent: "space-between"
  },
  rejectButton: {
    background: "#d32f2f",
    color: "#fff",
    "&:hover": {
      background: "#b71c1c"
    }
  },
  acceptButton: {
    background: "#10aa62",
    color: "#fff",
    "&:hover": {
      background: "#0d8f52"
    }
  },
  endButton: {
    background: "#d32f2f",
    color: "#fff",
    "&:hover": {
      background: "#b71c1c"
    }
  },
  hiddenAudio: {
    display: "none"
  }
}));

const normalizePhone = value => String(value || "").replace(/\D/g, "");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForIceGatheringComplete = (pc, timeoutMs = 7000) => {
  if (!pc || pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", checkState);
      resolve();
    }, timeoutMs);

    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };

    pc.addEventListener("icegatheringstatechange", checkState);
  });
};


const isOfficialOutgoingCall = (call = {}) => {
  const direction = String(call?.direction || "").toUpperCase();
  const action = String(call?.action || "").toLowerCase();

  return (
    direction === "BUSINESS_INITIATED" ||
    direction === "OUTGOING" ||
    action === "outgoing"
  );
};

const getOfficialRemotePhone = (call = {}, previousCall = {}) => {
  const direction = String(call?.direction || previousCall?.direction || "").toUpperCase();
  const action = String(call?.action || previousCall?.action || "").toLowerCase();

  const isOutgoing =
    direction === "BUSINESS_INITIATED" ||
    direction === "OUTGOING" ||
    action === "outgoing";

  if (isOutgoing) {
    return normalizePhone(
      call?.to ||
        call?.phone_to ||
        previousCall?.to ||
        previousCall?.phone_to ||
        previousCall?.phone ||
        call?.phone
    );
  }

  return normalizePhone(
    call?.from ||
      call?.phone ||
      call?.phone_to ||
      previousCall?.from ||
      previousCall?.phone ||
      previousCall?.phone_to
  );
};


const OfficialCallNotification = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const socketRef = useRef(null);
  const currentCallRef = useRef(null);
  const ringtoneRef = useRef(null);
  const callStatusRef = useRef("ringing");
  const acceptingCallIdsRef = useRef(new Set());

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const recordingAudioContextRef = useRef(null);
  const recordingDestinationRef = useRef(null);
  const recordingSourcesRef = useRef({});

  const ringtoneContextRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const ringtoneNodesRef = useRef([]);

  const [open, setOpen] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callStatus, setCallStatus] = useState("ringing");
  const [loadingAction, setLoadingAction] = useState(false);

  const updateCallStatus = status => {
    callStatusRef.current = status;
    setCallStatus(status);
  };

  const getCallKey = call => {
    return String(call?.call_id || call?.id || "").trim();
  };





  const isBusinessInitiatedCall = (call = {}, previousCall = {}) => {
    const direction = String(
      call?.direction ||
        previousCall?.direction ||
        ""
    ).toUpperCase();

    return direction === "BUSINESS_INITIATED" || direction === "OUTGOING";
  };

  const getRemotePhoneFromCall = (call = {}, previousCall = {}) => {
    const direction = String(
      call?.direction ||
        previousCall?.direction ||
        ""
    ).toUpperCase();

    if (direction === "BUSINESS_INITIATED" || direction === "OUTGOING") {
      return normalizePhone(
        call?.to ||
          call?.phone_to ||
          call?.phone ||
          previousCall?.to ||
          previousCall?.phone_to ||
          previousCall?.phone
      );
    }

    return normalizePhone(
      call?.from ||
        call?.phone ||
        call?.phone_to ||
        previousCall?.from ||
        previousCall?.phone ||
        previousCall?.phone_to
    );
  };


  const setCallState = call => {
    currentCallRef.current = call;
    setCurrentCall(call);
  };

  const getOfficialApiUrl = () => {
    const url =
      process.env.REACT_APP_API_OFICIAL_URL ||
      process.env.REACT_APP_URL_API_OFICIAL ||
      process.env.REACT_APP_OFFICIAL_API_URL ||
      "";

    return String(url || "").replace(/\/$/, "");
  };

  const stopRingtone = () => {
    try {
      if (ringtoneRef.current?.stop) {
        ringtoneRef.current.stop();
      }

      ringtoneRef.current = null;
    } catch (error) {
      console.warn("[OfficialCallNotification] erro ao parar toque:", error);
    }
  };

  const startRingtone = () => {
    try {
      stopRingtone();

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioCtx = new AudioContextClass();

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
      compressor.connect(audioCtx.destination);

      const masterGain = audioCtx.createGain();

      // Volume geral do toque. Pode subir até 1.0 se quiser mais alto.
      masterGain.gain.value = 0.65;
      masterGain.connect(compressor);

      let stopped = false;
      const timers = [];
      const nodes = [];

      const playBeep = (frequency, delayMs, durationMs) => {
        const timer = setTimeout(() => {
          if (stopped) return;

          const now = audioCtx.currentTime;
          const oscillator = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          // square fica muito mais audível que sine
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(frequency, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.75, now + 0.015);
          gain.gain.setValueAtTime(0.75, now + durationMs / 1000 - 0.04);
          gain.gain.linearRampToValueAtTime(0.001, now + durationMs / 1000);

          oscillator.connect(gain);
          gain.connect(masterGain);

          oscillator.start(now);
          oscillator.stop(now + durationMs / 1000 + 0.03);

          nodes.push(oscillator, gain);
        }, delayMs);

        timers.push(timer);
      };

      const ringPattern = () => {
        if (stopped) return;

        // Padrão forte: trim-trim + pausa
        playBeep(880, 0, 260);
        playBeep(1320, 280, 260);
        playBeep(880, 700, 260);
        playBeep(1320, 980, 260);
      };

      ringPattern();

      const interval = setInterval(ringPattern, 2300);
      timers.push(interval);

      ringtoneRef.current = {
        stop: () => {
          stopped = true;

          timers.forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
          });

          nodes.forEach(node => {
            try {
              node.disconnect();
            } catch {}
          });

          try {
            masterGain.disconnect();
            compressor.disconnect();
          } catch {}

          try {
            if (audioCtx.state !== "closed") {
              audioCtx.close();
            }
          } catch {}
        }
      };
    } catch (error) {
      console.warn("[OfficialCallNotification] erro ao iniciar toque:", error);
    }
  };

  const getRecordingMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg"
    ];

    return types.find(type => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || "";
  };

  const connectStreamToRecording = (stream, key) => {
    try {
      if (!stream || !recordingAudioContextRef.current || !recordingDestinationRef.current) {
        return;
      }

      if (recordingSourcesRef.current[key]) return;

      const source = recordingAudioContextRef.current.createMediaStreamSource(stream);
      source.connect(recordingDestinationRef.current);

      recordingSourcesRef.current[key] = source;

      console.log("[OfficialCallNotification] stream conectado à gravação:", key);
    } catch (error) {
      console.warn("[OfficialCallNotification] erro ao conectar stream:", key, error);
    }
  };

  const startCallRecording = async localStream => {
    try {
      if (!window.MediaRecorder) {
        console.warn("[OfficialCallNotification] MediaRecorder não suportado.");
        return;
      }

      if (mediaRecorderRef.current) return;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const destination = audioContext.createMediaStreamDestination();

      recordingAudioContextRef.current = audioContext;
      recordingDestinationRef.current = destination;
      recordingSourcesRef.current = {};
      recordedChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      connectStreamToRecording(localStream, "local");

      if (remoteStreamRef.current) {
        connectStreamToRecording(remoteStreamRef.current, "remote");
      }

      const mimeType = getRecordingMimeType();

      const recorder = new MediaRecorder(
        destination.stream,
        mimeType ? { mimeType } : undefined
      );

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = error => {
        console.error("[OfficialCallNotification] erro no MediaRecorder:", error);
      };

      recorder.start(1000);

      mediaRecorderRef.current = recorder;

      console.log("[OfficialCallNotification] gravação iniciada:", {
        mimeType: recorder.mimeType
      });
    } catch (error) {
      console.error("[OfficialCallNotification] erro ao iniciar gravação:", error);
    }
  };

  const stopRecordingAndUpload = async call => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) return null;

    const mimeType = recorder.mimeType || "audio/webm";

    const stopped = new Promise(resolve => {
      recorder.onstop = resolve;
    });

    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
        await stopped;
      }
    } catch (error) {
      console.warn("[OfficialCallNotification] erro ao parar gravação:", error);
    }

    mediaRecorderRef.current = null;

    try {
      if (recordingAudioContextRef.current) {
        await recordingAudioContextRef.current.close();
      }
    } catch (error) {}

    recordingAudioContextRef.current = null;
    recordingDestinationRef.current = null;
    recordingSourcesRef.current = {};

    const chunks = recordedChunksRef.current || [];

    if (!chunks.length) {
      console.warn("[OfficialCallNotification] gravação sem chunks.");
      return null;
    }

    const extension = mimeType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(chunks, { type: mimeType });

    recordedChunksRef.current = [];

    const callId = call?.call_id || call?.id || "";
    const duration = recordingStartedAtRef.current
      ? Math.round((Date.now() - recordingStartedAtRef.current) / 1000)
      : 0;

    recordingStartedAtRef.current = null;

    const formData = new FormData();
    formData.append("recording", blob, `meta-official-${Date.now()}.${extension}`);
    formData.append("call_id", callId);
    formData.append("call_history_id", call?.callHistoryId || "");
    formData.append("duration", String(duration));

    console.log("[OfficialCallNotification] enviando gravação:", {
      callId,
      callHistoryId: call?.callHistoryId,
      duration,
      size: blob.size,
      mimeType
    });

    const response = await api.post("/official-call-recording", formData);

    console.log("[OfficialCallNotification] gravação salva:", response?.data);

    return response?.data;
  };

  const stopMedia = () => {
    stopRingtone();

    try {
      if (pcRef.current) {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      }
    } catch (error) {
      console.warn("[OfficialCallNotification] erro ao fechar WebRTC:", error);
    }

    pcRef.current = null;

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    } catch (error) {}

    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const callOfficialAction = async (action, call, session) => {
    const companyId = user?.companyId;
    const conexaoId =
      Number(
        call?.apiConexaoId ||
          call?.whatsappOficialId ||
          call?.conexaoId ||
          call?.connectionId ||
          call?.raw?.apiConexaoId ||
          call?.raw?.whatsappOficialId ||
          call?.raw?.conexaoId ||
          0
      ) || null;

    const localId = String(call?.id || "");

    const callId =
      action === "connect"
        ? ""
        : call?.call_id || (localId.startsWith("out-") ? "" : call?.id);
    const backendWhatsappId =
      Number(
        call?.backendWhatsappId ||
          call?.whatsapp_id ||
          call?.whatsappId ||
          call?.conexaoBackendId ||
          call?.raw?.backendWhatsappId ||
          call?.raw?.whatsapp_id ||
          call?.raw?.whatsappId ||
          call?.conexaoId ||
          call?.connectionId ||
          0
      ) || null;

    let phoneNumberId =
      call?.phone_number_id ||
      call?.phoneNumberId ||
      call?.raw?.phone_number_id ||
      call?.raw?.metadata?.phone_number_id ||
      call?.metadata?.phone_number_id ||
      call?.whatsapp?.phone_number_id ||
      call?.connection?.phone_number_id ||
      null;

    let displayPhoneNumber =
      call?.display_phone_number ||
      call?.displayPhoneNumber ||
      call?.raw?.display_phone_number ||
      call?.raw?.metadata?.display_phone_number ||
      call?.metadata?.display_phone_number ||
      call?.whatsapp?.phone_number ||
      call?.connection?.phone_number ||
      null;

    let connectionToken =
      call?.token ||
      call?.token_mult100 ||
      call?.raw?.token ||
      call?.raw?.token_mult100 ||
      null;

    if ((!phoneNumberId || !displayPhoneNumber || !connectionToken) && backendWhatsappId) {
      try {
        let whatsappData = null;

        try {
          const response = await api.get(`/whatsapp/${backendWhatsappId}`);
          whatsappData = response?.data?.whatsapp || response?.data;
        } catch (error) {
          const response = await api.get("/whatsapp");
          const list = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.whatsapps)
              ? response.data.whatsapps
              : Array.isArray(response?.data?.whatsapp)
                ? response.data.whatsapp
                : [];

          whatsappData = list.find(item => Number(item?.id) === Number(backendWhatsappId));
        }

        if (whatsappData) {
          phoneNumberId =
            phoneNumberId ||
            whatsappData?.phone_number_id ||
            whatsappData?.phoneNumberId ||
            null;

          displayPhoneNumber =
            displayPhoneNumber ||
            whatsappData?.phone_number ||
            whatsappData?.phoneNumber ||
            whatsappData?.number ||
            null;

          connectionToken =
            connectionToken ||
            whatsappData?.token ||
            whatsappData?.token_mult100 ||
            null;
        }
      } catch (error) {
        console.warn("[OfficialCallNotification] não foi possível buscar dados da conexão oficial:", error);
      }
    }

    const officialApiUrl = getOfficialApiUrl();

    if (!officialApiUrl) {
      throw new Error(
        "URL da API Oficial não configurada. Defina REACT_APP_API_OFICIAL_URL no .env do frontend."
      );
    }

    if (
      !companyId ||
      !conexaoId ||
      (!["connect", "request_permission"].includes(action) && !callId)
    ) {
      throw new Error("Dados insuficientes para executar ação da chamada oficial.");
    }

    console.log("[OfficialCallNotification] enviando ação oficial:", {
      action,
      companyId,
      conexaoId,
      backendWhatsappId,
      callId,
      phoneNumberId,
      displayPhoneNumber,
      hasConnectionToken: !!connectionToken,
      to: call?.to || call?.phone || call?.phone_to || null,
      hasSession: !!session,
      sdpLength: session?.sdp?.length || 0,
      officialApiUrl
    });

    const response = await fetch(
      `${officialApiUrl}/v1/official-calls/${companyId}/${conexaoId}/action`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          ...(callId ? { call_id: callId } : {}),
          user_id: user?.id || null,
          userId: user?.id || null,
          attendantId: user?.id || null,
          phone_number_id: phoneNumberId,
          phoneNumberId,
          token: connectionToken,
          session,
          to: call?.to || call?.phone || call?.phone_to || null,
          from: call?.from || displayPhoneNumber || null,
          direction: call?.direction || "USER_INITIATED",
          display_phone_number: displayPhoneNumber || null
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    console.log("[OfficialCallNotification] resposta ação oficial:", {
      action,
      status: response.status,
      ok: response.ok,
      result
    });

    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || `Erro ao executar ação ${action}.`);
    }

    return result;
  };


  const getSessionFromConnectResult = result => {
    return (
      result?.session ||
      result?.result?.session ||
      result?.call?.session ||
      result?.result?.call?.session ||
      result?.calls?.[0]?.session ||
      result?.result?.calls?.[0]?.session ||
      null
    );
  };

  const applyRemoteAnswerFromConnect = async result => {
    const session = getSessionFromConnectResult(result);
    const answerSdp = session?.sdp || "";
    const sdpType = session?.sdp_type || session?.sdpType || "answer";

    console.log("[OfficialCallNotification] resposta connect SDP:", {
      hasSession: !!session,
      sdpType,
      sdpLength: answerSdp?.length || 0
    });

    if (!answerSdp) {
      console.warn("[OfficialCallNotification] connect sem SDP answer no retorno.");
      return false;
    }

    if (!pcRef.current) {
      console.warn("[OfficialCallNotification] peer connection ausente para aplicar answer.");
      return false;
    }

    await pcRef.current.setRemoteDescription({
      type: sdpType === "answer" ? "answer" : sdpType,
      sdp: answerSdp
    });

    console.log("[OfficialCallNotification] SDP answer aplicado com sucesso.");

    return true;
  };



  const applyOutboundAnswerFromWebhook = async call => {
    try {
      const session = call?.session || {};
      const sdp = session?.sdp || "";
      const sdpType = String(session?.sdp_type || session?.sdpType || "").toLowerCase();

      if (!sdp || sdpType !== "answer") {
        console.warn("[OfficialCallNotification] sem SDP answer válido para aplicar:", {
          call_id: call?.call_id || call?.id,
          sdpType,
          hasSdp: !!sdp
        });

        return false;
      }

      if (!pcRef.current) {
        console.warn("[OfficialCallNotification] SDP answer recebido, mas pcRef está vazio.", {
          call_id: call?.call_id || call?.id
        });

        return false;
      }

      if (pcRef.current.remoteDescription?.sdp) {
        console.log("[OfficialCallNotification] SDP answer já aplicado anteriormente.");
        return true;
      }

      console.log("[OfficialCallNotification] aplicando SDP answer recebido via webhook:", {
        call_id: call?.call_id || call?.id,
        signalingState: pcRef.current.signalingState,
        sdpLength: sdp.length
      });

      await pcRef.current.setRemoteDescription({
        type: "answer",
        sdp
      });

      console.log("[OfficialCallNotification] SDP answer outbound aplicado com sucesso.");

      return true;
    } catch (error) {
      console.error("[OfficialCallNotification] erro ao aplicar SDP answer outbound:", error);
      return false;
    }
  };

  const prepareWebRTCAnswer = async call => {
    const offerSdp =
      call?.session?.sdp ||
      call?.connection?.webrtc?.sdp ||
      call?.connection?.sdp ||
      "";

    console.log("[OfficialCallNotification] preparando WebRTC answer:", {
      callId: call?.call_id || call?.id,
      hasOfferSdp: !!offerSdp,
      offerSdpLength: offerSdp?.length || 0
    });

    if (!offerSdp) {
      throw new Error("SDP offer da Meta não encontrado nesta chamada.");
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      console.log("[OfficialCallNotification] ICE:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[OfficialCallNotification] PeerConnection:", pc.connectionState);
    };

    pc.ontrack = event => {
      console.log("[OfficialCallNotification] áudio remoto recebido:", event);

      const stream =
        event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);

      remoteStreamRef.current = stream;
      connectStreamToRecording(stream, "remote");

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(error => {
          console.warn("[OfficialCallNotification] autoplay remoto:", error);
        });
      }
    };

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    localStreamRef.current = localStream;

    await startCallRecording(localStream);

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    await pc.setRemoteDescription({
      type: "offer",
      sdp: offerSdp
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await waitForIceGatheringComplete(pc, 7000);

    if (!pc.localDescription?.sdp) {
      throw new Error("Não foi possível gerar SDP answer local.");
    }

    return {
      sdp_type: "answer",
      sdp: pc.localDescription.sdp
    };
  };

  const prepareWebRTCOffer = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      console.log("[OfficialCallNotification] ICE:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[OfficialCallNotification] PeerConnection:", pc.connectionState);
    };

    pc.ontrack = event => {
      console.log("[OfficialCallNotification] áudio remoto recebido na saída:", event);

      const stream =
        event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);

      remoteStreamRef.current = stream;
      connectStreamToRecording(stream, "remote");

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(error => {
          console.warn("[OfficialCallNotification] autoplay remoto saída:", error);
        });
      }
    };

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    localStreamRef.current = localStream;

    await startCallRecording(localStream);

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });

    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc, 7000);

    if (!pc.localDescription?.sdp) {
      throw new Error("Não foi possível gerar SDP offer local.");
    }

    return {
      sdp_type: "offer",
      sdp: pc.localDescription.sdp
    };
  };

  useEffect(() => {
    const companyId = user?.companyId;
    const userId = user?.id;

    if (!companyId || !userId) return;

    const socket = socketConnection({ companyId, userId });
    socketRef.current = socket;

    const eventName = `company-${companyId}-officialCall`;

    console.log("[OfficialCallNotification] listener montado:", {
      companyId,
      userId,
      eventName,
      socketConnected: socket?.connected,
      socketId: socket?.id
    });

    const onOfficialCall = data => {
      const call = data?.call || data || {};
      const previousCall = currentCallRef.current || {};

      const isBusinessInitiated = isBusinessInitiatedCall(call, previousCall);
      const phone = getRemotePhoneFromCall(call, previousCall);

      const normalizedCall = {
        ...previousCall,
        ...call,
        phone,
        phone_to: phone || call?.phone_to || previousCall?.phone_to,
        provider: data?.provider || call.provider || "meta_official",
        action: isBusinessInitiated
          ? "outgoing"
          : data?.action || call.action || "incoming"
      };

      const isOutgoingWebhook =
        String(normalizedCall?.direction || "").toUpperCase() === "BUSINESS_INITIATED" ||
        String(normalizedCall?.direction || "").toUpperCase() === "OUTGOING" ||
        String(normalizedCall?.action || "").toLowerCase() === "outgoing";

      if (isOutgoingWebhook) {
        normalizedCall.phone = getOfficialRemotePhone(normalizedCall, previousCall);
        normalizedCall.phone_to = normalizedCall.phone;
        normalizedCall.action = "outgoing";
      }

      console.log("[OfficialCallNotification] evento de chamada:", normalizedCall);

      const hasOutboundAnswerSdp =
        isOfficialOutgoingCall(normalizedCall) &&
        String(
          normalizedCall?.session?.sdp_type ||
            normalizedCall?.session?.sdpType ||
            ""
        ).toLowerCase() === "answer" &&
        !!normalizedCall?.session?.sdp;

      if (hasOutboundAnswerSdp) {
        console.log("[OfficialCallNotification] SDP answer detectado antes do ignore:", {
          call_id: normalizedCall?.call_id || normalizedCall?.id,
          sdpLength: normalizedCall?.session?.sdp?.length || 0,
          signalingState: pcRef.current?.signalingState || null
        });

        applyOutboundAnswerFromWebhook(normalizedCall).then(applied => {
          console.log("[OfficialCallNotification] resultado aplicação SDP answer antes do ignore:", {
            applied
          });

          if (applied) {
            updateCallStatus("active");
          }
        });
      }

      const normalizedStatus = String(normalizedCall.status || "").toLowerCase();
      const normalizedEvent = String(normalizedCall.event || "").toLowerCase();
      const normalizedAction = String(normalizedCall.action || "").toLowerCase();

      const isFinishedEvent =
        ["ended", "completed", "terminated", "terminate", "rejected", "missed"].includes(normalizedStatus) ||
        ["ended", "completed", "terminated", "terminate", "rejected", "missed"].includes(normalizedEvent) ||
        normalizedAction === "update";

      const incomingCallKey = getCallKey(normalizedCall);
      const previousCallKey = getCallKey(previousCall);

      const isSameCurrentCall =
        incomingCallKey &&
        previousCallKey &&
        incomingCallKey === previousCallKey;

      const isAlreadyBeingHandled =
        isSameCurrentCall &&
        ["connecting", "active"].includes(callStatusRef.current);

      const isMediaUpdateFailed =
        normalizedStatus === "media_update_failed" ||
        normalizedEvent === "media_update_failed";

      if (!isFinishedEvent && (isAlreadyBeingHandled || acceptingCallIdsRef.current.has(incomingCallKey) || isMediaUpdateFailed)) {
        setCallState(normalizedCall);
        stopRingtone();

        if (callStatusRef.current === "ringing") {
          updateCallStatus("active");
        } else {
          updateCallStatus(callStatusRef.current);
        }

        console.log("[OfficialCallNotification] evento ignorado como nova chamada, pois já está em atendimento:", {
          incomingCallKey,
          status: normalizedStatus,
          event: normalizedEvent,
          currentStatus: callStatusRef.current
        });

        return;
      }

      if (isFinishedEvent) {
        const callSnapshot = currentCallRef.current || normalizedCall;

        stopRecordingAndUpload(callSnapshot)
          .catch(error => {
            console.error("[OfficialCallNotification] erro ao salvar gravação no evento final:", error);
          })
          .finally(() => {
            acceptingCallIdsRef.current.delete(getCallKey(callSnapshot));
          stopMedia();
          });

        setOpen(false);
        setCallState(null);
        updateCallStatus("ended");

        toast.info(`📴 Chamada API Oficial finalizada: ${phone || "Número desconhecido"}`, {
          autoClose: 5000
        });

        return;
      }

      if (isBusinessInitiated) {
        setCallState(normalizedCall);
        setOpen(true);

        const businessStatus = String(
          normalizedCall.status ||
            normalizedCall.event ||
            ""
        ).toLowerCase();

        updateCallStatus(
          ["connect", "connected", "accepted", "in_progress", "calling"].includes(businessStatus)
            ? "active"
            : "connecting"
        );

        console.log("[OfficialCallNotification] chamada de saída atualizada:", {
          phone,
          call_id: normalizedCall?.call_id || normalizedCall?.id,
          status: normalizedCall?.status,
          event: normalizedCall?.event
        });

        return;
      }

      if (isOfficialOutgoingCall(normalizedCall)) {
        normalizedCall.phone = getOfficialRemotePhone(normalizedCall, previousCall);
        normalizedCall.phone_to = normalizedCall.phone;
        normalizedCall.action = "outgoing";

        stopRingtone();
        setCallState(normalizedCall);
        setOpen(true);
        updateCallStatus("active");

        console.log("[OfficialCallNotification] BUSINESS_INITIATED tratado como saída:", {
          phone: normalizedCall.phone,
          from: normalizedCall.from,
          to: normalizedCall.to,
          direction: normalizedCall.direction,
          status: normalizedCall.status,
          event: normalizedCall.event,
          call_id: normalizedCall.call_id || normalizedCall.id
        });

        return;
      }

      setCallState(normalizedCall);
      updateCallStatus("ringing");
      setOpen(true);
      startRingtone();

      toast.info(`📞 Chamada recebida via API Oficial: ${phone || "Número desconhecido"}`, {
        autoClose: 8000
      });
    };

    socket.on(eventName, onOfficialCall);

    return () => {
      if (socket && typeof socket.off === "function") {
        socket.off(eventName, onOfficialCall);
      }
    };
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    const onStartOfficialCall = async event => {
      const detail = event?.detail || {};

      console.log("[OfficialCallNotification] evento start-official-call recebido:", detail);

      const phone = String(detail?.phone || detail?.phone_to || "").replace(/\D/g, "");

      if (!phone) {
        toast.error("Número inválido para iniciar chamada.");
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        toast.error("Este navegador não permite capturar microfone via WebRTC.");
        return;
      }

      const outboundCall = {
        id: `out-${Date.now()}`,
        call_id: "",
        phone,
        phone_to: phone,
        to: phone,
        from: detail?.display_phone_number || null,
        name: detail?.name || phone,
        status: "calling",
        direction: "BUSINESS_INITIATED",
        source: "meta_official",
        provider: "meta_official",
        conexaoId: detail?.conexaoId || 1,
        phone_number_id: detail?.phone_number_id || null,
        display_phone_number: detail?.display_phone_number || null
      };

      try {
        stopMedia();

        setCallState(outboundCall);
        updateCallStatus("connecting");
        setOpen(true);
        setLoadingAction(true);

        toast.info(`Ligando para ${detail?.name || phone}...`);

        const offerSession = await prepareWebRTCOffer();

        console.log("[OfficialCallNotification] enviando connect:", {
          phone,
          conexaoId: outboundCall.conexaoId,
          phone_number_id: outboundCall.phone_number_id,
          sdpLength: offerSession?.sdp?.length || 0
        });

        const result = await callOfficialAction("connect", outboundCall, offerSession);

        await applyRemoteAnswerFromConnect(result);

        const metaCallId = String(
          result?.call_id ||
            result?.id ||
            result?.result?.call_id ||
            result?.result?.id ||
            result?.result?.calls?.[0]?.id ||
            result?.calls?.[0]?.id ||
            ""
        ).trim();

        const finalCall = {
          ...outboundCall,
          id: metaCallId || outboundCall.id,
          call_id: metaCallId,
          status: "calling"
        };

        setCallState(finalCall);
        updateCallStatus("active");

        toast.success("Chamada iniciada.");
      } catch (error) {
        console.error("[OfficialCallNotification] erro ao iniciar chamada oficial:", error);

        const errorMessage =
          error?.message ||
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "";

        const isPermissionError =
          errorMessage.toLowerCase().includes("permiss") ||
          errorMessage.toLowerCase().includes("permission");

        if (isPermissionError) {
          const shouldRequestPermission = window.confirm(
            "Este contato ainda não autorizou chamadas da empresa. Deseja enviar uma solicitação de permissão pelo WhatsApp?"
          );

          if (shouldRequestPermission) {
            try {
              await callOfficialAction("request_permission", outboundCall, null);
              toast.success("Solicitação de permissão enviada ao contato.");
            } catch (permissionError) {
              console.error(
                "[OfficialCallNotification] erro ao solicitar permissão:",
                permissionError
              );

              toast.error(
                permissionError?.message ||
                  "Erro ao solicitar permissão de ligação."
              );
            }
          }
        } else {
          toast.error(errorMessage || "Erro ao iniciar chamada oficial.");
        }

        stopMedia();
        setOpen(false);
        setCallState(null);
        updateCallStatus("ended");
      } finally {
        setLoadingAction(false);
      }
    };

    window.addEventListener("start-official-call", onStartOfficialCall);

    return () => {
      window.removeEventListener("start-official-call", onStartOfficialCall);
    };
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!ringtoneContextRef.current) {
          ringtoneContextRef.current = new AudioContextClass();
        }

        if (ringtoneContextRef.current.state === "suspended") {
          await ringtoneContextRef.current.resume();
        }
      } catch (error) {}
    };

    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      stopMedia();
    };
  }, []);

  const handleClose = () => {
    if (callStatus === "active" || callStatus === "connecting") {
      toast.info("Use o botão Encerrar para finalizar a chamada.");
      return;
    }

    setOpen(false);
  };

  const handleReject = async () => {
    try {
      setLoadingAction(true);
      stopRingtone();

      if (!currentCall) {
        toast.error("Nenhuma chamada oficial ativa para recusar.");
        return;
      }

      if (isOfficialOutgoingCall(currentCall)) {
        toast.info("Esta é uma chamada realizada. Use Encerrar para finalizar.");
        return;
      }

      await callOfficialAction("reject", currentCall);

      toast.success("Chamada recusada com sucesso.");
      stopMedia();
      setOpen(false);
      setCallState(null);
      updateCallStatus("ended");
    } catch (error) {
      console.error("[OfficialCallNotification] erro ao recusar:", error);
      toast.error(error?.message || "Erro ao recusar chamada oficial.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAccept = async () => {
    const callSnapshot = currentCallRef.current || currentCall;
    const callKey = getCallKey(callSnapshot);

    try {
      if (!callSnapshot) {
        toast.error("Nenhuma chamada oficial ativa para atender.");
        return;
      }

      if (!callKey) {
        toast.error("ID da chamada não encontrado para atender.");
        return;
      }

      if (acceptingCallIdsRef.current.has(callKey) || ["connecting", "active"].includes(callStatusRef.current)) {
        toast.info("Esta chamada já está sendo atendida.");
        stopRingtone();
        updateCallStatus("active");
        return;
      }

      if (isOfficialOutgoingCall && isOfficialOutgoingCall(callSnapshot)) {
        toast.info("Esta chamada já foi iniciada pela empresa. Use Encerrar para finalizar.");
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        toast.error("Este navegador não permite capturar microfone via WebRTC.");
        return;
      }

      acceptingCallIdsRef.current.add(callKey);
      setLoadingAction(true);
      stopRingtone();
      updateCallStatus("connecting");

      toast.info("Preparando áudio da chamada...");

      const answerSession = await prepareWebRTCAnswer(callSnapshot);

      await callOfficialAction("pre_accept", callSnapshot, answerSession);
      await sleep(400);
      await callOfficialAction("accept", callSnapshot, answerSession);

      updateCallStatus("active");
      setCallState({
        ...callSnapshot,
        status: "accepted"
      });

      toast.success("Chamada atendida com sucesso.");
    } catch (error) {
      acceptingCallIdsRef.current.delete(callKey);

      console.error("[OfficialCallNotification] erro ao atender:", error);
      toast.error(error?.message || "Erro ao atender chamada oficial.");

      stopMedia();
      updateCallStatus("ringing");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTerminate = async () => {
    try {
      setLoadingAction(true);

      const callSnapshot = currentCallRef.current || currentCall;

      await stopRecordingAndUpload(callSnapshot).catch(error => {
        console.error("[OfficialCallNotification] erro ao enviar gravação:", error);
      });

      const snapshotId = String(callSnapshot?.id || "");
      const hasRealCallId =
        !!callSnapshot?.call_id ||
        (!!callSnapshot?.id && !snapshotId.startsWith("out-"));

      if (hasRealCallId) {
        await callOfficialAction("terminate", callSnapshot);
      } else {
        console.warn("[OfficialCallNotification] chamada sem call_id real para terminate:", callSnapshot);
      }

      acceptingCallIdsRef.current.delete(getCallKey(callSnapshot));
      toast.success("Chamada encerrada.");
      stopMedia();
      setOpen(false);
      setCallState(null);
      updateCallStatus("ended");
    } catch (error) {
      console.error("[OfficialCallNotification] erro ao encerrar:", error);
      toast.error(error?.message || "Erro ao encerrar chamada oficial.");
      stopMedia();
      setOpen(false);
    } finally {
      setLoadingAction(false);
    }
  };

  const phone = getRemotePhoneFromCall(currentCall || {}, {}) || "Número desconhecido";
  const callId = currentCall?.call_id || currentCall?.id || "N/A";

  const isOutgoingCurrentCall = isOfficialOutgoingCall(currentCall || {});
  const isRinging = callStatus === "ringing" && !isOutgoingCurrentCall;
  const isConnecting = callStatus === "connecting";
  const isActive = callStatus === "active" || isOutgoingCurrentCall;

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className={classes.hiddenAudio} />

      <Dialog
        open={open}
        hideBackdrop
        disableEnforceFocus
        disableAutoFocus
        disableRestoreFocus
        keepMounted
        style={{
          pointerEvents: "none"
        }}
        PaperProps={{
          style: {
            pointerEvents: "auto",
            position: "fixed",
            right: 24,
            bottom: 24,
            margin: 0,
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            borderRadius: 16,
            overflow: "hidden"
          }
        }}
      >
        <DialogTitle disableTypography className={classes.header}>
          <Typography variant="h6">
            {isConnecting || isActive
              ? "📞 Chamada em andamento"
              : isBusinessInitiatedCall(currentCall || {}, {})
                ? "📞 Chamada realizada"
                : "📞 Chamada recebida"}
          </Typography>
          <Typography variant="body2">
            API Oficial / Meta Calls
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box mt={3} mb={2} textAlign="center">
            <div className={classes.pulse}>
              {loadingAction ? <CircularProgress size={34} color="inherit" /> : "☎"}
            </div>
          </Box>

          <Paper elevation={0} className={classes.infoBox}>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("whatsappModalRel.form.number")}
            </Typography>
            <Typography className={classes.number}>
              {phone}
            </Typography>

            <Box mt={1}>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("financial.status")}
              </Typography>
              <Typography variant="body1">
                {isConnecting ? "conectando" : isActive ? "em atendimento" : currentCall?.status || "ringing"}
              </Typography>
            </Box>

            <Box mt={1}>
              <Typography variant="body2" color="textSecondary">
                ID da chamada
              </Typography>
              <Typography variant="caption">
                {callId}
              </Typography>
            </Box>
          </Paper>
        </DialogContent>

        <DialogActions className={classes.actions}>
          {isRinging && (
            <>
              <Button
                variant="contained"
                className={classes.rejectButton}
                onClick={handleReject}
                disabled={loadingAction}
              >
                Recusar
              </Button>

              <Button
                variant="contained"
                className={classes.acceptButton}
                onClick={handleAccept}
                disabled={loadingAction}
              >
                Atender
              </Button>
            </>
          )}

          {(isConnecting || isActive) && (
            <Button
              fullWidth
              variant="contained"
              className={classes.endButton}
              onClick={handleTerminate}
              disabled={loadingAction}
            >
              Encerrar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OfficialCallNotification;
