declare module 'react-native-zeroconf' {
  export default class Zeroconf {
    constructor();

    scan(
      type?: string,
      protocol?: string,
      domain?: string,
      implementation?: string
    ): void;

    stop(
      implementation?: string
    ): void;

    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, any>,
      implementation?: string
    ): void;

    unpublishService(
      name: string
    ): void;

    getServices():
      Record<string, any>;

    on(
      event: string,
      listener:
        (...args: any[]) => void
    ): this;

    removeListener(
      event: string,
      listener:
        (...args: any[]) => void
    ): this;
  }
}