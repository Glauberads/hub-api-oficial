import React, { useState, useEffect, useContext } from 'react';
import { useHistory } from "react-router-dom";
import QRCode from 'react-qr-code';
import { SuccessContent, Total } from './style';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { FaCopy, FaCheckCircle } from 'react-icons/fa';
import { socketConnection } from "../../../services/socket";
import { useDate } from "../../../hooks/useDate";
import { toast } from "react-toastify";
import { AuthContext } from '../../../context/Auth/AuthContext';
import { SocketContext } from '../../../context/Socket/SocketContext';
import { i18n } from "../../../translate/i18n";
import { formatCurrencyValue } from "../../../context/Currency/CurrencyContext";

function CheckoutSuccess(props) {

  const { pix } = props;
  const socketManager = useContext(SocketContext);
  const [pixString,] = useState(pix?.qrcode?.qrcode || '');
  const [stripeURL,] = useState(pix.stripeURL);
  const [asaasURL,] = useState(pix.asaasURL);
  const [mercadopagoURL,] = useState(pix.mercadopagoURL);
  const [valorext,] = useState(pix.valorext);
  const [currency,] = useState(pix.currency || 'BRL');
  const [copied, setCopied] = useState(false);
  const history = useHistory();

  const { dateToClient } = useDate();
  const { user, socket } = useContext(AuthContext);

  const companyId = user.companyId;

  useEffect(() => {
    const onCompanyPayment = (data) => {
      if (data.action === "CONCLUIDA") {
        toast.success(i18n.t("finalTouches.checkout.licenseRenewed", { date: dateToClient(data.company.dueDate) }));
        setTimeout(() => {
          history.push("/");
        }, 4000);
      }
    }
    socket.on(`company-${companyId}-payment`, onCompanyPayment);
    
    return () => {
      socket.disconnect();
    }
  }, [history, dateToClient, socketManager]);

  const handleCopyQR = () => {
    setTimeout(() => {
      setCopied(false);
    }, 1 * 1000);
    setCopied(true);
  };

  return (
    <React.Fragment>
      <Total>
        <p><span>{i18n.t("finalTouches.checkout.total").toUpperCase()}</span></p>
        <strong>{formatCurrencyValue(valorext, currency)}</strong>
      </Total>

	

    <SuccessContent>
  
  	{pixString && (
    <>
  
    <QRCode value={pixString} />
    <CopyToClipboard text={pixString} onCopy={handleCopyQR}>
      <button className="copy-button" type="button">
        {copied ? (
          <>
            <span>{i18n.t("finalTouches.checkout.copied")}</span>
            <FaCheckCircle size={18} />
          </>
        ) : (
          <>
            <span>{i18n.t("finalTouches.checkout.copyPix")}</span>
            <FaCopy size={18} />
          </>
        )}
      </button>
    </CopyToClipboard>
    <span>
      {i18n.t("finalTouches.checkout.pixHelp")}
    </span>
	<span><p> </p></span>
    
    </>
    )}
    
    {stripeURL && (
    <>
	<button onClick={() => window.open(stripeURL, '_blank')} type="button"

	style={{
    color: '#3c6afb',
    background: '#ffffff',
    border: '1px solid #3c6afb',
    padding: '6px 16px',
    fontSize: '18px',
    minWidth: '50%',
    boxSizing: 'border-box',
    transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeight: '500',
    lineHeight: '1.75',
    borderRadius: '4px',
    letterSpacing: '0.02857em',
    textTransform: 'uppercase',
    // Add any additional styles here
  	}}

	>
      {i18n.t("finalTouches.checkout.payCreditCard")}
    </button>
	<span><p> </p></span>
    </>
    )}
    
    
    {mercadopagoURL && (
    <>
    <button onClick={() => window.open(mercadopagoURL, '_blank')} type="button"

	style={{
    color: '#3c6afb',
    background: '#ffffff',
    border: '1px solid #3c6afb',
    padding: '6px 16px',
    fontSize: '18px',
    minWidth: '50%',
    boxSizing: 'border-box',
    transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeight: '500',
    lineHeight: '1.75',
    borderRadius: '4px',
    letterSpacing: '0.02857em',
    textTransform: 'uppercase',
    // Add any additional styles here
  	}}

	>
      {i18n.t("finalTouches.checkout.payMercadoPago")}
    </button>
	<span><p> </p></span>
    </>
    )}
    
    {asaasURL && (
    <>
    <button onClick={() => window.open(asaasURL, '_blank')} type="button"

	style={{
    color: '#3c6afb',
    background: '#ffffff',
    border: '1px solid #3c6afb',
    padding: '6px 16px',
    fontSize: '18px',
    minWidth: '50%',
    boxSizing: 'border-box',
    transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeight: '500',
    lineHeight: '1.75',
    borderRadius: '4px',
    letterSpacing: '0.02857em',
    textTransform: 'uppercase',
    // Add any additional styles here
  	}}

	>
      {i18n.t("finalTouches.checkout.payAsaas")}
    </button>
	<span><p> </p></span>
    </>
    )}
    
    
</SuccessContent>
    </React.Fragment>
  );
}

export default CheckoutSuccess;
