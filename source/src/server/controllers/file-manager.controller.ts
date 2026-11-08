import type { Request, Response } from 'express';
import type { FileManagerScope } from '../../shared/api/contracts/file-manager/types';
import type { FileManagerService } from '../services/file-manager.service';
import { asyncHandler } from '../utils/asyncHandler';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
};

const parseScope = (value: unknown): FileManagerScope => (
  value === 'project' ? 'project' : 'workspace'
);

const sendServiceResult = <T>(
  res: Response,
  result: { ok: true; body: T } | { ok: false; status: number; error: string },
  successStatus = 200,
): void => {
  if (!result.ok) {
    res.status(result.status).json({ success: false, error: result.error });
    return;
  }

  res.status(successStatus).json({ success: true, data: result.body });
};

export class FileManagerController {
  constructor(private readonly fileManagerService: FileManagerService) {}

  getConfig = asyncHandler(async (_req: Request, res: Response) => {
    sendServiceResult(res, await this.fileManagerService.getConfig());
  }, 'Failed to read file manager config.');

  listChildren = asyncHandler(async (req: Request, res: Response) => {
    const scope = parseScope(req.query.scope);
    const pathValue = typeof req.query.path === 'string' ? req.query.path : '';
    sendServiceResult(res, await this.fileManagerService.listChildren(pathValue, scope));
  }, 'Failed to list directory entries.');

  readContent = asyncHandler(async (req: Request, res: Response) => {
    const scope = parseScope(req.query.scope);
    const pathValue = typeof req.query.path === 'string' ? req.query.path : '';
    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }
    sendServiceResult(res, await this.fileManagerService.readContent(pathValue, scope));
  }, 'Failed to read file content.');

  readRaw = asyncHandler(async (req: Request, res: Response) => {
    const scope = parseScope(req.query.scope);
    const pathValue = typeof req.query.path === 'string' ? req.query.path : '';
    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    const result = await this.fileManagerService.readRawFile(pathValue, scope);
    if (!result.ok) {
      res.status(result.status).json({ success: false, error: result.error });
      return;
    }

    if (result.body.mimeType) {
      res.setHeader('Content-Type', result.body.mimeType);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SEC-2-3 — sandbox user-served files (SVG/HTML) so a stored payload cannot run scripts.
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.send(result.body.buffer);
  }, 'Failed to read raw file.');

  writeContent = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; content?: unknown; scope?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const scope = parseScope(body.scope);

    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.writeContent(pathValue, content, scope));
  }, 'Failed to write file content.');

  createFolder = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { parentPath?: unknown; name?: unknown; scope?: unknown };
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const scope = parseScope(body.scope);

    if (!name.trim()) {
      res.status(400).json({ success: false, error: 'Folder name is required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.createFolder(parentPath, name, scope), 201);
  }, 'Failed to create folder.');

  createFile = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { parentPath?: unknown; name?: unknown; scope?: unknown };
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const scope = parseScope(body.scope);

    if (!name.trim()) {
      res.status(400).json({ success: false, error: 'File name is required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.createFile(parentPath, name, scope), 201);
  }, 'Failed to create file.');

  renameEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; newName?: unknown; scope?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const newName = typeof body.newName === 'string' ? body.newName : '';
    const scope = parseScope(body.scope);

    if (!pathValue.trim() || !newName.trim()) {
      res.status(400).json({ success: false, error: 'Path and new name are required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.renameEntry(pathValue, newName, scope));
  }, 'Failed to rename entry.');

  moveEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; destinationParentPath?: unknown; scope?: unknown; overwrite?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const destinationParentPath = typeof body.destinationParentPath === 'string' ? body.destinationParentPath : '';
    const scope = parseScope(body.scope);
    const overwrite = body.overwrite === true || body.overwrite === 'true' || body.overwrite === 1;

    if (!pathValue.trim() || !destinationParentPath.trim()) {
      res.status(400).json({ success: false, error: 'Path and destination folder are required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.moveEntry(pathValue, destinationParentPath, scope, overwrite),
    );
  }, 'Failed to move entry.');

  deleteEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; scope?: unknown; recursive?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const scope = parseScope(body.scope);
    const recursive = body.recursive === true;

    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.deleteEntry(pathValue, scope, recursive));
  }, 'Failed to delete entry.');

  emptyFolder = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; scope?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const scope = parseScope(body.scope);

    sendServiceResult(res, await this.fileManagerService.emptyFolder(pathValue, scope));
  }, 'Failed to empty folder.');

  extractZip = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; scope?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const scope = parseScope(body.scope);

    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.extractZipArchive(pathValue, scope), 201);
  }, 'Failed to extract zip archive.');

  replaceImage = asyncHandler(async (req: Request, res: Response) => {
    const pathValue = typeof req.body?.path === 'string' ? req.body.path : '';
    const scope = parseScope(req.body?.scope);
    const uploadedFile = req.file as UploadedFile | undefined;

    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    if (!uploadedFile?.buffer?.length) {
      res.status(400).json({ success: false, error: 'Image file is required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.replaceImageFile(pathValue, uploadedFile.buffer, scope),
    );
  }, 'Failed to save image.');

  replaceImageContent = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { path?: unknown; scope?: unknown; contentBase64?: unknown };
    const pathValue = typeof body.path === 'string' ? body.path : '';
    const scope = parseScope(body.scope);
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : '';

    if (!pathValue.trim()) {
      res.status(400).json({ success: false, error: 'Path is required.' });
      return;
    }

    if (!contentBase64) {
      res.status(400).json({ success: false, error: 'Image content is required.' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch {
      res.status(400).json({ success: false, error: 'Image content is not valid base64.' });
      return;
    }

    if (!buffer.length) {
      res.status(400).json({ success: false, error: 'Image content is empty.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.replaceImageFile(pathValue, buffer, scope),
    );
  }, 'Failed to save image.');

  uploadFiles = asyncHandler(async (req: Request, res: Response) => {
    const parentPath = typeof req.body?.parentPath === 'string' ? req.body.parentPath : '';
    const scope = parseScope(req.body?.scope);
    const uploadedFiles = (Array.isArray(req.files) ? req.files : []) as UploadedFile[];

    if (!uploadedFiles.length) {
      res.status(400).json({ success: false, error: 'No files provided.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.uploadFiles(
        parentPath,
        uploadedFiles.map((file) => ({
          originalName: file.originalname,
          buffer: file.buffer,
        })),
        scope,
      ),
      201,
    );
  }, 'Failed to upload files.');

  listZipEntries = asyncHandler(async (req: Request, res: Response) => {
    const scope = parseScope(req.query.scope);
    const archivePath = typeof req.query.archivePath === 'string' ? req.query.archivePath : '';
    if (!archivePath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path is required.' });
      return;
    }
    sendServiceResult(res, await this.fileManagerService.listZipEntries(archivePath, scope));
  }, 'Failed to list zip entries.');

  readZipEntryContent = asyncHandler(async (req: Request, res: Response) => {
    const scope = parseScope(req.query.scope);
    const archivePath = typeof req.query.archivePath === 'string' ? req.query.archivePath : '';
    const entryPath = typeof req.query.entryPath === 'string' ? req.query.entryPath : '';
    if (!archivePath.trim() || !entryPath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and entry path are required.' });
      return;
    }
    sendServiceResult(res, await this.fileManagerService.readZipEntryContent(archivePath, entryPath, scope));
  }, 'Failed to read zip entry content.');

  writeZipEntryContent = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { archivePath?: unknown; entryPath?: unknown; content?: unknown; scope?: unknown };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const entryPath = typeof body.entryPath === 'string' ? body.entryPath : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const scope = parseScope(body.scope);

    if (!archivePath.trim() || !entryPath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and entry path are required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.writeZipEntryContent(archivePath, entryPath, content, scope));
  }, 'Failed to write zip entry content.');

  deleteZipEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { archivePath?: unknown; entryPath?: unknown; scope?: unknown };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const entryPath = typeof body.entryPath === 'string' ? body.entryPath : '';
    const scope = parseScope(body.scope);

    if (!archivePath.trim() || !entryPath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and entry path are required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.deleteZipEntry(archivePath, entryPath, scope));
  }, 'Failed to delete zip entry.');

  moveZipEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      archivePath?: unknown;
      entryPath?: unknown;
      destinationParentPath?: unknown;
      scope?: unknown;
      overwrite?: unknown;
    };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const entryPath = typeof body.entryPath === 'string' ? body.entryPath : '';
    const destinationParentPath = typeof body.destinationParentPath === 'string' ? body.destinationParentPath : '';
    const scope = parseScope(body.scope);
    const overwrite = body.overwrite === true || body.overwrite === 'true' || body.overwrite === 1;

    if (!archivePath.trim() || !entryPath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and entry path are required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.moveZipEntry(archivePath, entryPath, destinationParentPath, scope, overwrite),
    );
  }, 'Failed to move zip entry.');

  renameZipEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { archivePath?: unknown; entryPath?: unknown; newName?: unknown; scope?: unknown };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const entryPath = typeof body.entryPath === 'string' ? body.entryPath : '';
    const newName = typeof body.newName === 'string' ? body.newName : '';
    const scope = parseScope(body.scope);

    if (!archivePath.trim() || !entryPath.trim() || !newName.trim()) {
      res.status(400).json({ success: false, error: 'Archive path, entry path, and new name are required.' });
      return;
    }

    sendServiceResult(res, await this.fileManagerService.renameZipEntry(archivePath, entryPath, newName, scope));
  }, 'Failed to rename zip entry.');

  createZipFolder = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { archivePath?: unknown; parentPath?: unknown; name?: unknown; scope?: unknown };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const scope = parseScope(body.scope);

    if (!archivePath.trim() || !name.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and folder name are required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.createZipFolder({ archivePath, parentPath, name, scope }),
      201,
    );
  }, 'Failed to create zip folder.');

  createZipFile = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { archivePath?: unknown; parentPath?: unknown; name?: unknown; scope?: unknown };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const scope = parseScope(body.scope);

    if (!archivePath.trim() || !name.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and file name are required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.createZipFile({ archivePath, parentPath, name, scope }),
      201,
    );
  }, 'Failed to create zip file.');

  importZipEntry = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      archivePath?: unknown;
      destinationParentPath?: unknown;
      sourcePath?: unknown;
      scope?: unknown;
      overwrite?: unknown;
    };
    const archivePath = typeof body.archivePath === 'string' ? body.archivePath : '';
    const destinationParentPath = typeof body.destinationParentPath === 'string' ? body.destinationParentPath : '';
    const sourcePath = typeof body.sourcePath === 'string' ? body.sourcePath : '';
    const scope = parseScope(body.scope);
    const overwrite = body.overwrite === true || body.overwrite === 'true' || body.overwrite === 1;

    if (!archivePath.trim() || !sourcePath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path and source path are required.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.importZipEntryFromWorkspace({
        archivePath,
        destinationParentPath,
        sourcePath,
        scope,
        overwrite,
      }),
      201,
    );
  }, 'Failed to import file into zip archive.');

  uploadZipEntries = asyncHandler(async (req: Request, res: Response) => {
    const archivePath = typeof req.body?.archivePath === 'string' ? req.body.archivePath : '';
    const destinationParentPath = typeof req.body?.destinationParentPath === 'string'
      ? req.body.destinationParentPath
      : '';
    const scope = parseScope(req.body?.scope);
    const uploadedFiles = (Array.isArray(req.files) ? req.files : []) as UploadedFile[];

    if (!archivePath.trim()) {
      res.status(400).json({ success: false, error: 'Archive path is required.' });
      return;
    }

    if (!uploadedFiles.length) {
      res.status(400).json({ success: false, error: 'No files provided.' });
      return;
    }

    sendServiceResult(
      res,
      await this.fileManagerService.uploadZipEntries(
        archivePath,
        destinationParentPath,
        uploadedFiles.map((file) => ({
          originalName: file.originalname,
          buffer: file.buffer,
        })),
        scope,
      ),
      201,
    );
  }, 'Failed to upload files into zip archive.');
}
