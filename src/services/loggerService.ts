class LoggerService {
    private readonly className: string;

    constructor(className: string = '') {
        this.className = className;
    }

    static create<T>(this: new (...args: any[]) => T): LoggerService {
        return new LoggerService(this.name); // get the name of the class calling it
    }

    log(message: string): void {
        const formattedMessage = this.getMessage(message);
        console.log(formattedMessage);
    }

    getMessage(message: string): string {
        return `[${this.className}] ${message}`;
    }
}

export default LoggerService;