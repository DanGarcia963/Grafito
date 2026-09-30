import 'dotenv/config';
export declare function integerEnv(name: string, fallback: number): number;
export declare function allowedOrigins(): string[];
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => void;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
};
export declare function redisConnection(): {
    tls?: {} | undefined;
    host: string;
    port: number;
    username: string | undefined;
    password: string | undefined;
    db: number;
} | {
    host: string;
    port: number;
    password: string | undefined;
};
