export const SQL_CONSOLE_GENERAL_COLLECTION_ID = 'general';
export const SQL_CONSOLE_GENERAL_COLLECTION_NAME = 'General';

export function isSqlConsoleGeneralCollection(collection: { id: string; name: string }): boolean {
  return collection.id === SQL_CONSOLE_GENERAL_COLLECTION_ID
    || collection.name === SQL_CONSOLE_GENERAL_COLLECTION_NAME;
}
