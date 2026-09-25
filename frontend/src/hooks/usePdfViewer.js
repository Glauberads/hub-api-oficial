import { useCallback } from 'react';

export const usePdfViewer = () => {
  
  // Processar URL para garantir que esteja no formato correto
  const processUrl = useCallback((url) => {
    if (!url) return '';
    
    try {
      // Se a URL já tem protocolo, retornar como está
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Se começa com /public/, usar a URL base do backend
      if (url.startsWith('/public/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        return `${backendUrl}${url}`;
      }
      
      // Se é apenas um nome de arquivo ou caminho relativo
      // ✅ CORRIGIDO: Extrair companyId da URL ou usar padrão
      // Para arquivos do fluxo, eles ficam em public/company{companyId}/ e não em public/company{companyId}/flow/
      if (!url.startsWith('/')) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        // Se a URL contém "company" e um número, usar esse caminho
        if (url.includes('company') && url.match(/company\d+/)) {
          return `${backendUrl}/public/${url}`;
        }
        // Caso contrário, assumir que é apenas o nome do arquivo e precisa do companyId
        // Mas como não temos acesso ao companyId aqui, vamos tentar construir a URL
        // O backend deve salvar apenas o nome do arquivo, e aqui construímos o caminho completo
        // Por padrão, arquivos ficam em public/company{companyId}/, mas precisamos do companyId
        // Por enquanto, vamos assumir que se não começar com /, é apenas o nome do arquivo
        // e o componente que chama deve fornecer o caminho completo ou usar o padrão
        return `${backendUrl}/public/${url}`;
      }
      
      // Para outros casos, assumir que é um caminho absoluto do servidor
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      return `${backendUrl}${url}`;
      
    } catch (error) {
      console.error('❌ Erro ao processar URL:', error);
      return url;
    }
  }, []);

  // Verificar se uma URL é um PDF
  const isPdfUrl = (mediaUrl, body, mediaType) => {
    // Verifica pelo mediaType primeiro
    if (mediaType === "application/pdf") return true;
    
    // Verifica pela extensão do arquivo na URL
    if (mediaUrl) {
      const url = mediaUrl.toLowerCase();
      return url.endsWith('.pdf') || 
             url.includes('.pdf?') || 
             url.includes('/pdf/');
    }
    
    // Verifica no body como fallback
    if (body) {
      return body.toLowerCase().includes('.pdf');
    }
    
    return false;
  };

  // Validar se a URL parece ser válida
  const validatePdfUrl = useCallback((url, filename) => {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // URLs muito curtas provavelmente são inválidas
    if (url.length < 5) {
      return false;
    }

    // Verificar se tem caracteres suspeitos
    if (url.includes('undefined') || url.includes('null')) {
      return false;
    }

    return true;
  }, []);

  // Fazer download do PDF
  const downloadPdf = useCallback((url, filename = 'documento.pdf') => {
    console.log('📥 Fazendo download:', { url, filename });
    
    if (!url) {
      console.error('❌ URL do PDF não fornecida para download');
      alert('Erro: Não é possível fazer download, URL não encontrada');
      return;
    }

    try {
      // Processar URL antes do download
      const processedUrl = processUrl(url);
      
      const link = document.createElement('a');
      link.href = processedUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Adicionar ao DOM temporariamente
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Download iniciado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao fazer download:', error);
      
      // Fallback: abrir em nova aba
      try {
        const processedUrl = processUrl(url);
        window.open(processedUrl, '_blank', 'noopener,noreferrer');
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        alert('Erro ao fazer download do arquivo');
      }
    }
  }, [processUrl]);

  // Extrair informações de um arquivo PDF de uma mensagem
  const extractPdfInfoFromMessage = useCallback((message, companyId = null) => {
    console.log('🔍 Extraindo info do PDF da mensagem:', message);
    
    // ✅ CORRIGIDO: O mediaUrl já vem do backend com a URL completa construída pelo modelo Message
    // O modelo Message constrói: ${BACKEND_URL}/public/company${companyId}/flow/${fileName}
    // Então não precisamos fazer transformações, apenas usar o mediaUrl diretamente
    let mediaUrl = message.mediaUrl || '';
    
    // Se mediaUrl já é uma URL completa (começa com http), usar diretamente
    // Se não, o processUrl vai construir corretamente
    const processedUrl = mediaUrl.startsWith('http') ? mediaUrl : processUrl(mediaUrl);
    
    const info = {
      url: processedUrl,
      filename: 'documento.pdf',
      size: message.fileSize || null,
      mediaType: message.mediaType || '',
      isPdf: false
    };

    // Extrair filename do body da mensagem
    if (message.body && typeof message.body === 'string') {
      const body = message.body.trim();
      // Se o body é curto e tem extensão, provavelmente é um nome de arquivo
      if (body.length < 100 && body.includes('.')) {
        info.filename = body;
      }
    }

    // Extrair filename da URL se não obtido do body
    if (info.filename === 'documento.pdf' && info.url) {
      try {
        const urlParts = info.url.split('/');
        const urlFilename = urlParts[urlParts.length - 1];
        
        // Remover parâmetros de query se houver
        const cleanFilename = urlFilename.split('?')[0];
        const decodedFilename = decodeURIComponent(cleanFilename);
        
        if (decodedFilename && decodedFilename.includes('.')) {
          info.filename = decodedFilename;
        }
      } catch (error) {
        console.warn('⚠️ Erro ao extrair filename da URL:', error);
      }
    }

    // Verificar se é PDF
    info.isPdf = isPdfUrl(info.url, info.filename, info.mediaType);

    console.log('📄 Info extraída:', info);
    return info;
  }, [isPdfUrl, processUrl]);

  return {
    // Ações principais
    downloadPdf,
    
    // Utilitários
    isPdfUrl,
    validatePdfUrl,
    extractPdfInfoFromMessage,
    processUrl,
  };
};