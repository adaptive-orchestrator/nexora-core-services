import { DynamicModule } from '@nestjs/common';
export interface EventModuleOptions {
    clientId: string;
    consumerGroupId: string;
}
export declare class EventModule {
    static forRoot(options: EventModuleOptions): DynamicModule;
}
