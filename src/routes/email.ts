import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import fs from 'fs/promises'; // Use promises for async file deletion
import { config } from 'dotenv';

config(); // Load environment variables

const router = express.Router();

// Set up multer to handle multiple files
const upload = multer({ dest: 'uploads/' });
// TODO define request body type 

// Type for metadata 
type EmailMetadata = {
  subject: string;
  receiver: string;
  bodyText: string; 
  fileName: string;
};

router.post(
  '/send-pdfs',
  upload.array('files'), // field name in form-data
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('Headers:', req.headers['content-type']);
    console.log("req.file is", req.file)
    const files = req.files as Express.Multer.File[];
    console.log("request body ",req.body.metadata)
    console.log("type of request body metadta is ",typeof req.body.metadata)

    try {
      // Parse and validate metadata
      let metadata: EmailMetadata[];

      try {
        metadata = JSON.parse(req.body.metadata); // TODO: JSON.parse?
        if (
            !Array.isArray(metadata) ||
            !metadata.every(item =>
              item &&
              typeof item === 'object' &&
              typeof item.subject === 'string' &&
              typeof item.receiver === 'string' &&
              typeof item.bodyText === 'string' &&
              typeof item.fileName === 'string'
            )
          ) {
            throw new Error();
          }
      } catch {
        res.status(400).json({ error: 'Invalid metadata format' });
        return;
      }
      console.log("file length is", files.length)
      if (!files || files.length !== metadata.length) {
        res.status(400).json({ error: 'Mismatched number of files and metadata entries' });
        return;
      }

      // Set up Nodemailer transporter (using Gmail)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.APP_PWD,
        },
      });

      // Send each email
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = metadata[i];

        if (meta.fileName !== file.originalname) {
            throw new Error("File name mismatch");
        }

        await transporter.sendMail({
          to: meta.receiver,
          subject: meta.subject,
          text: meta.bodyText,
          attachments: [
            {
              filename: file.originalname,
              path: file.path,
            },
          ],
        });

        // Delete file asynchronously
        await fs.unlink(file.path);
      }

      res.status(200).json({ message: 'Emails sent successfully' });
    } catch (error) {
      console.error('Email sending failed:', error);
      res.status(500).json({ error: 'Failed to send emails: ' + error });
    }
  }
);

export default router;
