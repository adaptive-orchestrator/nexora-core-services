import { DynamicModule } from '@nestjs/common';
export interface DbModuleOptions {
    prefix: string;
}
export declare class DbModule {
    static forRoot(options: DbModuleOptions): DynamicModule;
}
