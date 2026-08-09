// types/resend.d.ts
declare module 'resend' {
  export interface ResendOptions {
    apiKey: string;
  }

  export interface SendEmailOptions {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    reply_to?: string;
    headers?: Record<string, string>;
  }

  export interface SendEmailResponse {
    id: string;
  }

  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: SendEmailOptions): Promise<{ data: SendEmailResponse | null; error: any }>;
    };
  }
}