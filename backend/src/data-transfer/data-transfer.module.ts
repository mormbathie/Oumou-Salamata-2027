import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataTransferController } from './data-transfer.controller';
import { DataTransferService } from './data-transfer.service';

@Module({ imports: [PrismaModule], controllers: [DataTransferController], providers: [DataTransferService] })
export class DataTransferModule {}
