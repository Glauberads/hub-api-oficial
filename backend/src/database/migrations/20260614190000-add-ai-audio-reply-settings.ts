import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        `
        INSERT INTO "Settings" ("key", "value", "companyId", "createdAt", "updatedAt")
        SELECT v.key, v.value, c.id, NOW(), NOW()
        FROM "Companies" c
        CROSS JOIN (
          VALUES
            ('aiAudioReplyEnabled', 'false'),
            ('aiAudioReplyOnlyWhenInputAudio', 'true'),
            ('aiAudioReplyProvider', 'openai'),
            ('aiAudioReplyModel', 'gpt-4o-mini-tts'),
            ('aiAudioReplyVoice', 'coral'),
            ('aiAudioReplySpeed', '1'),
            ('aiAudioReplyMaxChars', '700'),
            ('aiAudioReplySendTextWithLinks', 'true'),
            ('aiAudioReplyFallbackToText', 'true'),
            ('aiAudioReplyInstructions', 'Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo.')
        ) AS v(key, value)
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Settings" s
          WHERE s."companyId" = c.id
          AND s.key = v.key
        );
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        `
        DELETE FROM "Settings"
        WHERE "key" IN (
          'aiAudioReplyEnabled',
          'aiAudioReplyOnlyWhenInputAudio',
          'aiAudioReplyProvider',
          'aiAudioReplyModel',
          'aiAudioReplyVoice',
          'aiAudioReplySpeed',
          'aiAudioReplyMaxChars',
          'aiAudioReplySendTextWithLinks',
          'aiAudioReplyFallbackToText',
          'aiAudioReplyInstructions'
        );
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};