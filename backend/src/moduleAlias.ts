import Module from "module";

const originalResolveFilename = (Module as any)._resolveFilename;
let aliasInstalled = false;

export const installBaileysModuleAlias = (): void => {
  if (aliasInstalled) return;
  aliasInstalled = true;

  (Module as any)._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any
  ) {
    if (request === "@itsukichan/baileys") {
      request = "@whiskeysockets/baileys";
    }

    if (
      typeof request === "string" &&
      request.startsWith("@itsukichan/baileys/")
    ) {
      request = request.replace(
        "@itsukichan/baileys",
        "@whiskeysockets/baileys"
      );
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
};

export default installBaileysModuleAlias;