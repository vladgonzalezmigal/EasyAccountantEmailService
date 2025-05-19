import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import fs from 'fs/promises'; // Use promises for async file deletion
import { config } from 'dotenv';

config(); // Load environment variables

const router = express.Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  console.log("health check endpoint hit")
  res.status(200).json({ message: 'request received' });
});

// Set up multer to handle multiple files
const upload = multer({ dest: 'uploads/' });
// TODO define request body type 

// Helper function to clean up files
async function cleanupFiles(files: Express.Multer.File[]) {
  if (!files) return;
  
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error(`Failed to delete file ${file.path}:`, error);
    }
  }
}

// Type for metadata 
type EmailMetadata = {
  subject: string;
  receiver: string;
  sender: string;
  bodyText: string; 
  fileName: string;
};

router.post(
  '/send-pdfs',
  upload.array('files'), // field name in form-data
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    try {
      // Parse and validate metadata
      let metadata: EmailMetadata[];
      try {
        metadata = JSON.parse(req.body.metadata); // TODO: JSON.parse?
        if (!Array.isArray(metadata)) {
          throw new Error("metadata is not an array");
        }
        
        const validationResults = metadata.map((item, index) => {
          if (!item || typeof item !== 'object') {
            throw new Error(`Item ${index} is not a valid object`);
          }
          if (typeof item.subject !== 'string') {
            throw new Error(`Item ${index} has invalid subject`);
          }
          if (typeof item.receiver !== 'string') {
            throw new Error(`Item ${index} has invalid receiver`);
          }
          if (typeof item.bodyText !== 'string') {
            throw new Error(`Item ${index} has invalid bodyText`);
          }
          if (typeof item.fileName !== 'string') {
            throw new Error(`Item ${index} has invalid fileName`);
          }
          if (typeof item.sender !== 'string') {
            throw new Error(`Item ${index} has invalid sender`);
          }
          if (item.sender !== process.env.GMAIL_USER) {
            throw new Error(`Item ${index} sender does not match authorized account`);
          }
          
          return true;
        });
        
        if (!validationResults.every(Boolean)) {
          throw new Error();
        }
      } catch (error) {
        res.status(400).json({ error: 'Invalid metadata format or sender email does not match authorized account' });
        return;
      }
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
      }

      res.status(200).json({ message: 'Emails sent successfully' });
    } catch (error) {
      console.error('Email sending failed:', error);
      res.status(500).json({ error: 'Failed to send emails: ' + error });
    } finally {
      // Always clean up files, regardless of success or failure
      await cleanupFiles(files);
    }
  }
);

export default router;
