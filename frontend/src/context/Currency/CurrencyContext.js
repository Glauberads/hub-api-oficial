import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { AuthContext } from "../Auth/AuthContext";

export const CURRENCIES = {
  BRL: { code: "BRL", locale: "pt-BR", symbol: "R$" },
  COP: { code: "COP", locale: "es-CO", symbol: "$" },
  USD: { code: "USD", locale: "en-US", symbol: "US$" },
};

export const formatCurrencyValue = (amount, currency = "BRL") => {
  const config = CURRENCIES[currency] || CURRENCIES.BRL;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
  }).format(Number(amount || 0));
};

const CurrencyContext = createContext({
  ...CURRENCIES.BRL,
  currency: "BRL",
  setCurrency: () => {},
  formatCurrency: value => CURRENCIES.BRL.symbol + " " + Number(value || 0).toFixed(2),
});

export const CurrencyProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [currency, setCurrencyState] = useState("BRL");

  const setCurrency = useCallback(value => {
    setCurrencyState(CURRENCIES[value] ? value : "BRL");
  }, []);

  useEffect(() => {
    if (!user?.companyId) {
      setCurrency("BRL");
      return;
    }

    let active = true;
    api.get("/settings")
      .then(({ data }) => {
        const setting = data?.find(item => item.key === "currency");
        if (active) setCurrency(setting?.value || "BRL");
      })
      .catch(() => active && setCurrency("BRL"));

    return () => { active = false; };
  }, [setCurrency, user?.companyId]);

  const value = useMemo(() => {
    const config = CURRENCIES[currency] || CURRENCIES.BRL;
    return {
      ...config,
      currency,
      setCurrency,
      formatCurrency: amount => formatCurrencyValue(amount, config.code),
    };
  }, [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => useContext(CurrencyContext);

export default CurrencyContext;
