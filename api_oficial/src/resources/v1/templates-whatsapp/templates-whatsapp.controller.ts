import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { TemplatesWhatsappService } from "./templates-whatsapp.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

@Controller("v1/templates-whatsapp")
@ApiBearerAuth()
@ApiTags("Templates WhatsApp")
export class TemplatesWhatsappController {
  constructor(private readonly service: TemplatesWhatsappService) {}

  @Get(":token")
  findAll(@Param("token") token: string) {
    return this.service.findAll(token);
  }

  @Post(":token")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./public/templates",
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
    })
  )
  @ApiOperation({ summary: "Cria um novo template no WhatsApp Oficial" })
  @ApiResponse({ status: 201, description: "Template criado com sucesso" })
  @ApiResponse({ status: 400, description: "Erro ao criar o template" })
  create(
    @Param("token") token: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const payload =
      typeof body.data === "string" ? JSON.parse(body.data) : body;

    return this.service.create(token, payload, file?.path);
  }

  @Delete(":token/:templateName")
  remove(
    @Param("token") token: string,
    @Param("templateName") templateName: string
  ) {
    return this.service.remove(token, templateName);
  }
}