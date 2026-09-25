import { QueryInterface } from "sequelize";

const tableName = "EmailSettings";
const indexName = "EmailSettings_companyId_provider_unique";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const indexes: any = await queryInterface.showIndex(tableName);
    const indexList: any[] = Array.isArray(indexes) ? indexes : Object.values(indexes);

    const alreadyExists = indexList.some((index: any) => index.name === indexName);

    if (!alreadyExists) {
      await queryInterface.addIndex(tableName, ["companyId", "provider"], {
        unique: true,
        name: indexName
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexes: any = await queryInterface.showIndex(tableName);
    const indexList: any[] = Array.isArray(indexes) ? indexes : Object.values(indexes);

    const alreadyExists = indexList.some((index: any) => index.name === indexName);

    if (alreadyExists) {
      await queryInterface.removeIndex(tableName, indexName);
    }
  }
};