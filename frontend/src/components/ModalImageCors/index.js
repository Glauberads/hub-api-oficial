import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: "auto", // Redimensionar automaticamente a altura para manter a proporção
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	}
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");
	const [fetchFailed, setFetchFailed] = useState(false);

	useEffect(() => {
		if (!imageUrl) return;
		setFetching(true);
		setFetchFailed(false);
		setBlobUrl("");

		const fetchImage = async () => {
			try {
				let normalizedUrl = imageUrl;
				
				if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
					try {
						const urlObj = new URL(normalizedUrl);
						normalizedUrl = urlObj.pathname;
					} catch (e) {
						console.warn("[ModalImageCors] Erro ao parsear URL:", e);
					}
				} else if (!normalizedUrl.startsWith('/')) {
					normalizedUrl = `/${normalizedUrl}`;
				}
				
				const { data, headers } = await api.get(normalizedUrl, {
					responseType: "blob",
				});
				const url = window.URL.createObjectURL(
					new Blob([data], { type: headers["content-type"] })
				);
				setBlobUrl(url);
				setFetching(false);
			} catch (error) {
				console.warn("[ModalImageCors] Falha ao buscar via api, usando URL direta:", imageUrl);
				// Fallback: usar a URL original diretamente (funciona para URLs externas como Meta CDN)
				setFetchFailed(true);
				setFetching(false);
			}
		};
		fetchImage();
	}, [imageUrl]);

	// Determinar qual URL usar para exibição
	const displayUrl = fetching ? imageUrl : (blobUrl || (fetchFailed ? imageUrl : ""));

	return (
		<ModalImage
			className={classes.messageMedia}
			smallSrcSet={displayUrl}
			medium={displayUrl}
			large={displayUrl}
			alt="image"
			showRotate={true}
		/>
	);
};

export default ModalImageCors;
