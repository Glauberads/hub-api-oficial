import React, { useState, useEffect, useMemo } from "react";
import api from "./services/api";
import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { CssBaseline, useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo1.png";
import defaultLogoDark from "./assets/logo2.png";
import useSettings from "./hooks/useSettings";
import "./styles/animations.css";

const defaultLogoFavicon = "/favicon.ico";

const queryClient = new QueryClient();

const App = () => {
  const [locale, setLocale] = useState();
  const appColorLocalStorage =
    localStorage.getItem("primaryColorLight") ||
    localStorage.getItem("primaryColorDark") ||
    "#065183";
  const appNameLocalStorage = localStorage.getItem("appName") || "";
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preferredTheme = window.localStorage.getItem("preferredTheme");
  const [mode, setMode] = useState(
    preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light"
  );
  const [primaryColorLight, setPrimaryColorLight] =
    useState(appColorLocalStorage);
  const [primaryColorDark, setPrimaryColorDark] =
    useState(appColorLocalStorage);
  const [appLogoLight, setAppLogoLight] = useState(defaultLogoLight);
  const [appLogoDark, setAppLogoDark] = useState(defaultLogoDark);
  const [appLogoFavicon, setAppLogoFavicon] = useState(defaultLogoFavicon);
  const [appName, setAppName] = useState(appNameLocalStorage);
  const { getPublicSetting } = useSettings();

  const buildPublicAssetUrl = (value) => {
    if (!value) return "";

    const backendUrl = getBackendUrl().replace(/\/+$/, "");
    let raw = String(value).trim().replace(/\\/g, "/");

    if (
      /^https?:\/\//i.test(raw) ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:")
    ) {
      return raw;
    }

    const publicMarker = "/public/";
    const publicIndex = raw.lastIndexOf(publicMarker);

    if (publicIndex !== -1) {
      const relativePath = raw
        .slice(publicIndex + publicMarker.length)
        .replace(/^\/+/, "");
      return `${backendUrl}/public/${relativePath}`;
    }

    raw = raw.replace(/^\/+/, "");

    if (raw.startsWith("public/")) {
      return `${backendUrl}/${raw}`;
    }

    return `${backendUrl}/public/${raw}`;
  };

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          window.localStorage.setItem("preferredTheme", newMode);
          return newMode;
        });
      },
      setPrimaryColorLight,
      setPrimaryColorDark,
      setAppLogoLight,
      setAppLogoDark,
      setAppLogoFavicon,
      setAppName,
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      mode,
    }),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, mode]
  );

  const theme = useMemo(
    () =>
      createTheme(
        {
          scrollbarStyles: {
            "&::-webkit-scrollbar": {
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
              backgroundColor:
                mode === "light" ? primaryColorLight : primaryColorDark,
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: mode === "light" ? "#f5f5f5" : "#2a2a2a",
              borderRadius: "4px",
            },
          },

          scrollbarStylesSoft: {
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: mode === "light" ? "#E0E0E0" : "#404040",
              borderRadius: "4px",
              "&:hover": {
                backgroundColor: mode === "light" ? "#BDBDBD" : "#505050",
              }
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "transparent",
            },
          },

          palette: {
            type: mode,
            background: {
              default: mode === "light" ? "#f5f7fa" : "#202124",
              paper: mode === "light" ? "#ffffff" : "#303134",
            },
            text: {
              primary: mode === "light" ? "#172033" : "#f5f7fa",
              secondary: mode === "light" ? "#5f6b7a" : "#c4c9d1",
              disabled: mode === "light" ? "rgba(23,32,51,0.45)" : "rgba(245,247,250,0.5)",
            },
            divider: mode === "light" ? "rgba(23,32,51,0.12)" : "rgba(255,255,255,0.14)",
            action: {
              hover: mode === "light" ? "rgba(23,32,51,0.04)" : "rgba(255,255,255,0.07)",
              selected: mode === "light" ? "rgba(23,32,51,0.08)" : "rgba(255,255,255,0.11)",
              disabled: mode === "light" ? "rgba(23,32,51,0.35)" : "rgba(255,255,255,0.38)",
              disabledBackground: mode === "light" ? "rgba(23,32,51,0.08)" : "rgba(255,255,255,0.08)",
            },
            primary: {
              main: mode === "light" ? primaryColorLight : primaryColorDark,
              light: mode === "light"
                ? `${primaryColorLight}80`
                : `${primaryColorDark}80`,
              dark: mode === "light"
                ? `${primaryColorLight}CC`
                : `${primaryColorDark}CC`,
              contrastText: "#ffffff",
            },
            textPrimary:
              mode === "light" ? primaryColorLight : primaryColorDark,
            borderPrimary:
              mode === "light" ? primaryColorLight : primaryColorDark,
            dark: { main: mode === "light" ? "#333333" : "#F3F3F3" },
            light: { main: mode === "light" ? "#F3F3F3" : "#333333" },
            fontColor: mode === "light" ? primaryColorLight : primaryColorDark,
            tabHeaderBackground: mode === "light" ? "#EEE" : "#666",
            optionsBackground: mode === "light" ? "#fafafa" : "#333",
            fancyBackground: mode === "light" ? "#fafafa" : "#333",
            total: mode === "light" ? "#fff" : "#222",
            messageIcons: mode === "light" ? "grey" : "#F3F3F3",
            inputBackground: mode === "light" ? "#FFFFFF" : "#333",
            barraSuperior: mode === "light" ? primaryColorLight : "#666",
          },

          typography: {
            fontFamily: [
              "Inter",
              "Roboto",
              "-apple-system",
              "BlinkMacSystemFont",
              '"Segoe UI"',
              '"Helvetica Neue"',
              "Arial",
              "sans-serif",
            ].join(","),
            h1: {
              fontWeight: 700,
              letterSpacing: "-0.025em",
            },
            h2: {
              fontWeight: 700,
              letterSpacing: "-0.025em",
            },
            h3: {
              fontWeight: 600,
              letterSpacing: "-0.025em",
            },
            h4: {
              fontWeight: 600,
              letterSpacing: "-0.025em",
            },
            h5: {
              fontWeight: 600,
              letterSpacing: "-0.025em",
            },
            h6: {
              fontWeight: 600,
              letterSpacing: "-0.025em",
            },
            button: {
              fontWeight: 600,
              textTransform: "none",
              letterSpacing: "0.025em",
            },
          },

          shape: {
            borderRadius: 8,
          },
          overrides: {
            MuiButton: {
              root: {
                borderRadius: 8,
                textTransform: "none",
                fontWeight: 600,
                letterSpacing: "0.025em",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-1px)",
                },
                "&:active": {
                  transform: "translateY(0)",
                }
              },
              contained: {
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                "&:hover": {
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                }
              }
            },

            MuiContainer: {
              root: {
                paddingLeft: "0 !important",
                paddingRight: "0 !important",
                maxWidth: "none !important",
                width: "100% !important",
              },
              maxWidthLg: {
                maxWidth: "none !important",
              },
              maxWidthMd: {
                maxWidth: "none !important",
              },
              maxWidthSm: {
                maxWidth: "none !important",
              },
              maxWidthXl: {
                maxWidth: "none !important",
              },
              maxWidthXs: {
                maxWidth: "none !important",
              },
            },

            MuiPaper: {
              root: {
                backgroundImage: "none",
                color: mode === "light" ? "#172033" : "#f5f7fa",
              },
              rounded: {
                borderRadius: 12,
              },
              elevation1: {
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              },
              elevation2: {
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
              },
              elevation3: {
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }
            },

            MuiCard: {
              root: {
                backgroundColor: mode === "light" ? "#ffffff" : "#303134",
                color: mode === "light" ? "#172033" : "#f5f7fa",
              },
            },

            MuiTableCell: {
              root: {
                color: mode === "light" ? "#172033" : "#f5f7fa",
                borderBottomColor: mode === "light" ? "rgba(23,32,51,0.12)" : "rgba(255,255,255,0.14)",
              },
              head: {
                color: mode === "light" ? "#334155" : "#f5f7fa",
                backgroundColor: mode === "light" ? "#f1f5f9" : "#3c4043",
                fontWeight: 700,
              },
            },

            MuiInputBase: {
              root: {
                color: mode === "light" ? "#172033" : "#f5f7fa",
              },
              input: {
                "&::placeholder": {
                  color: mode === "light" ? "#6b7280" : "#b8bec7",
                  opacity: 1,
                },
              },
            },

            MuiInputLabel: {
              root: {
                color: mode === "light" ? "#5f6b7a" : "#c4c9d1",
              },
            },

            MuiFormHelperText: {
              root: {
                color: mode === "light" ? "#5f6b7a" : "#b8bec7",
              },
            },

            MuiOutlinedInput: {
              root: {
                "& $notchedOutline": {
                  borderColor: mode === "light" ? "rgba(23,32,51,0.24)" : "rgba(255,255,255,0.28)",
                },
                "&:hover $notchedOutline": {
                  borderColor: mode === "light" ? "rgba(23,32,51,0.45)" : "rgba(255,255,255,0.5)",
                },
              },
            },

            MuiDialog: {
              paper: {
                backgroundColor: mode === "light" ? "#ffffff" : "#303134",
                color: mode === "light" ? "#172033" : "#f5f7fa",
              },
            },

            MuiAlert: {
              root: {
                color: mode === "light" ? "#172033" : "#f5f7fa",
              },
            },

            MuiMenu: {
              paper: {
                width: "auto !important",
                maxWidth: "300px !important",
                minWidth: "180px !important",
              }
            },

            MuiPopover: {
              paper: {
                width: "auto !important",
                maxWidth: "300px !important",
                minWidth: "auto !important",
              }
            },

            MuiTextField: {
              root: {
                "& .MuiOutlinedInput-root": {
                  borderRadius: 8,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: mode === "light" ? "#ccc" : "#555",
                    }
                  },
                  "&.Mui-focused": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: mode === "light" ? primaryColorLight : primaryColorDark,
                      borderWidth: 2,
                    }
                  }
                }
              }
            },

            MuiTab: {
              root: {
                textTransform: "none",
                fontWeight: 600,
                letterSpacing: "0.025em",
                borderRadius: "8px 8px 0 0",
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundColor: mode === "light"
                    ? `${primaryColorLight}08`
                    : `${primaryColorDark}08`,
                },
                "&.Mui-selected": {
                  color: mode === "light" ? primaryColorLight : primaryColorDark,
                }
              }
            },

            MuiDrawer: {
              paper: {
                border: "none",
              }
            },

            MuiAppBar: {
              root: {
                boxShadow: "none",
              }
            }
          },

          mode,
          appLogoLight,
          appLogoDark,
          appLogoFavicon,
          appName,
          calculatedLogoDark: () => {
            if (
              appLogoDark === defaultLogoDark &&
              appLogoLight !== defaultLogoLight
            ) {
              return appLogoLight;
            }
            return appLogoDark;
          },
          calculatedLogoLight: () => {
            if (
              appLogoDark !== defaultLogoDark &&
              appLogoLight === defaultLogoLight
            ) {
              return appLogoDark;
            }
            return appLogoLight;
          },
        },
        locale || ptBR
      ),
    [
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      locale,
      mode,
      primaryColorDark,
      primaryColorLight,
    ]
  );

  useEffect(() => {
    window.localStorage.setItem("preferredTheme", mode);
  }, [mode]);

  useEffect(() => {
    getPublicSetting("primaryColorLight")
      .then((color) => {
        setPrimaryColorLight(color || "#0000FF");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("primaryColorDark")
      .then((color) => {
        setPrimaryColorDark(color || "#39ACE7");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("appLogoLight")
      .then((file) => {
        setAppLogoLight(file ? buildPublicAssetUrl(file) : defaultLogoLight);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("appLogoDark")
      .then((file) => {
        const darkLogoUrl = file ? buildPublicAssetUrl(file) : defaultLogoDark;
        setAppLogoDark(darkLogoUrl);

        const splashLogo = document.getElementById("splash-logo");
        if (splashLogo) {
          splashLogo.src = darkLogoUrl;
        }
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("appLogoFavicon")
      .then((file) => {
        setAppLogoFavicon(file ? buildPublicAssetUrl(file) : defaultLogoFavicon);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("appName")
      .then((name) => {
        setAppName(name || "Multizap Oficial");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
        setAppName("Multizap Oficial");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--primaryColor",
      mode === "light" ? primaryColorLight : primaryColorDark
    );
  }, [primaryColorLight, primaryColorDark, mode]);

  useEffect(() => {
    async function fetchVersionData() {
      try {
        const response = await api.get("/version");
        const { data } = response;
        window.localStorage.setItem("frontendVersion", data.version);
      } catch (error) {
        console.log("Error fetching data", error);
      }
    }
    fetchVersionData();
  }, []);

  return (
    <>
      <Favicon
        url={
          appLogoFavicon
            ? appLogoFavicon
            : defaultLogoFavicon
        }
      />
      <ColorModeContext.Provider value={{ colorMode }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <QueryClientProvider client={queryClient}>
            <ActiveMenuProvider>
              <Routes />
            </ActiveMenuProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
};

export default App;
