#!/usr/bin/env node
/**
 * Patch pós-instalação para Baileys v7
 *
 * 1) Corrige o bug de contacts.upsert não ser emitido.
 *    Causa raiz: await faltando em mutationKeys() dentro de chat-utils.ts
 *    Ref: https://github.com/WhiskeySockets/Baileys/issues/1900
 *         https://github.com/WhiskeySockets/Baileys/pull/2288
 *
 * 2) Corrige rejeição de pairing code em versões que ainda validam value=14
 *    no validate-connection (WhatsApp passou a exigir value=24).
 *    Ref: https://github.com/WhiskeySockets/Baileys/issues/2364
 */

const fs = require("fs");
const path = require("path");

const patchFile = (filePath, replacements, patchLabel) => {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, "utf-8");
  let changed = false;

  for (const replacement of replacements) {
    if (replacement.search.test(content)) {
      replacement.search.lastIndex = 0;
      const next = content.replace(replacement.search, replacement.replace);
      if (next !== content) {
        content = next;
        changed = true;
        console.log(`✅ [PATCH-BAILEYS] ${patchLabel} aplicado (${replacement.desc}) em: ${filePath}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  }

  console.log(`ℹ️  [PATCH-BAILEYS] ${patchLabel} já aplicado ou não necessário em: ${filePath}`);
  return true;
};

const chatUtilsPaths = [
  path.join(__dirname, "..", "node_modules", "@itsukichan", "baileys", "lib", "Utils", "chat-utils.js"),
  path.join(__dirname, "..", "node_modules", "@itsukichan", "baileys", "src", "Utils", "chat-utils.ts"),
  path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Utils", "chat-utils.js"),
  path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "src", "Utils", "chat-utils.ts"),
  path.join(__dirname, "..", "node_modules", "baileys", "lib", "Utils", "chat-utils.js"),
  path.join(__dirname, "..", "node_modules", "baileys", "src", "Utils", "chat-utils.ts"),
];

const eventBufferPaths = [
  path.join(__dirname, "..", "node_modules", "@itsukichan", "baileys", "lib", "Utils", "event-buffer.js"),
  path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Utils", "event-buffer.js"),
  path.join(__dirname, "..", "node_modules", "baileys", "lib", "Utils", "event-buffer.js"),
];

const validateConnectionPaths = [
  path.join(__dirname, "..", "node_modules", "@itsukichan", "baileys", "lib", "Utils", "validate-connection.js"),
  path.join(__dirname, "..", "node_modules", "@itsukichan", "baileys", "src", "Utils", "validate-connection.ts"),
  path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Utils", "validate-connection.js"),
  path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "src", "Utils", "validate-connection.ts"),
  path.join(__dirname, "..", "node_modules", "baileys", "lib", "Utils", "validate-connection.js"),
  path.join(__dirname, "..", "node_modules", "baileys", "src", "Utils", "validate-connection.ts"),
];

let patchedAnything = false;

for (const filePath of chatUtilsPaths) {
  patchedAnything =
    patchFile(
      filePath,
      [
        {
          search: /return\s+(?!await\s+)(mutationKeys\s*\()/g,
          replace: "return await $1",
          desc: "await mutationKeys"
        }
      ],
      "contacts.upsert fix"
    ) || patchedAnything;
}

for (const filePath of eventBufferPaths) {
  patchedAnything =
    patchFile(
      filePath,
      [
        {
          // Insere a função shouldIncrementChatUnread se ela não existir no arquivo
          // mas é referenciada em decrementChatReadCounterIfMsgDidUnread
          search: /\bshouldIncrementChatUnread\s*\(/g,
          replace: "((msg) => !msg?.key?.fromMe)(",
          desc: "inline shouldIncrementChatUnread"
        }
      ],
      "shouldIncrementChatUnread fix"
    ) || patchedAnything;
}

for (const filePath of validateConnectionPaths) {
  patchedAnything =
    patchFile(
      filePath,
      [
        {
          search: /(\bvalue\s*===\s*)14\b/g,
          replace: "$124",
          desc: "value === 24"
        },
        {
          search: /(\bvalue\s*!==\s*)14\b/g,
          replace: "$124",
          desc: "value !== 24"
        }
      ],
      "pairing-code validate-connection fix"
    ) || patchedAnything;
}

if (!patchedAnything) {
  console.log("⚠️  [PATCH-BAILEYS] Nenhum arquivo do Baileys encontrado para patch.");
  console.log("    Verifique se as dependências foram instaladas corretamente.");
} else {
  console.log("✅ [PATCH-BAILEYS] Rotina de patch concluída.");
}
