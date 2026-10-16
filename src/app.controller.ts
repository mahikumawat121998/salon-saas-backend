import { Controller, Get, Post, Body } from "@nestjs/common";
import { AppService } from "./app.service";
import { Public } from "./common/decorators/public.decorator";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Post("contact")
  async handleContactForm(@Body() body: { email: string; mobile: string; query: string }) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "email-smtp.ap-south-1.amazonaws.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || process.env.SMTP_USERNAME, // using SMTP_USERNAME fallback since notificationservice uses it
          pass: process.env.SMTP_PASSWORD,
        },
      });

      if (process.env.SMTP_PASSWORD) {
        const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead - SalonNO</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #18181b; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e4e4e7; }
    .header { background: linear-gradient(135deg, #5b3af7 0%, #7C3AED 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #e0e7ff; margin: 8px 0 0; font-size: 15px; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #f4f4f5; }
    .section:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .label { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 16px; color: #09090b; font-weight: 500; line-height: 1.5; margin: 0; }
    .value-box { background-color: #fafafa; border: 1px solid #f4f4f5; padding: 16px; border-radius: 12px; font-size: 15px; color: #27272a; line-height: 1.6; margin-top: 8px; }
    .footer { background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7; }
    .footer p { margin: 0; color: #a1a1aa; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Demo Request</h1>
      <p>A new prospect wants to get started with SalonNO!</p>
    </div>
    <div class="content">
      <div class="section">
        <span class="label">Prospect Email</span>
        <p class="value"><a href="mailto:${body.email}" style="color: #5b3af7; text-decoration: none;">${body.email}</a></p>
      </div>
      <div class="section">
        <span class="label">Mobile Number</span>
        <p class="value">${body.mobile}</p>
      </div>
      <div class="section">
        <span class="label">Business Query</span>
        <div class="value-box">${body.query.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} SalonNO. This is an automated system notification.</p>
    </div>
  </div>
</body>
</html>
        `;

        await transporter.sendMail({
          from: `"SalonNO Website" <no-reply@salonno.com>`,
          to: "mahikumawat121998@gmail.com",
          subject: "🚀 New 'Get Started' Lead from Website",
          html: htmlTemplate,
        });
        return { success: true, message: "Email sent successfully" };
      }
      return { success: false, message: "SMTP credentials missing in backend .env" };
    } catch (error) {
      console.error("Failed to send contact email:", error);
      return { success: false, message: "Failed to send email" };
    }
  }
}
