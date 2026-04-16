import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  sendMail(to: string, subject: string, text: string) {
    // 模拟发邮件
    console.log(to, subject, text);
  }
}
