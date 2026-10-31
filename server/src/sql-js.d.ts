declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface Statement {
    bind(params: any[]): void;
    step(): boolean;
    getAsObject(): any;
    run(params: any[]): { changes: number };
    free(): void;
    reset(): void;
  }
  export default function initSqlJs(opts: {
    locateFile: (filename: string) => string;
  }): Promise<{ Database: new (buffer?: Uint8Array | null) => Database }>;
}
