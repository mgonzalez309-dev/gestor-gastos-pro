import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MAX_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp|gif|bmp|tiff)$/;

const multerStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `ticket-${uuid()}${ext}`);
  },
});

const multerOptions = {
  storage: multerStorage,
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Tipo de archivo no permitido: ${file.mimetype}. Se aceptan imágenes JPEG, PNG, WEBP, GIF, BMP o TIFF.`,
        ),
        false,
      );
    }
  },
};

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Subir imagen de ticket y procesar OCR' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadTicket(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.ticketsService.uploadAndProcess(req.user.id, file);
  }

  @Post(':id/parse')
  @ApiOperation({ summary: 'Solicitar re-procesamiento OCR de un ticket existente' })
  parseTicket(@Param('id') id: string, @Request() req) {
    return this.ticketsService.parseTicket(id, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tickets del usuario autenticado' })
  findAll(@Request() req) {
    return this.ticketsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un ticket por ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.ticketsService.findOne(id, req.user.id);
  }
}
