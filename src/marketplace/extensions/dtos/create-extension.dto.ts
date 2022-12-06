import { ApiProperty } from '@nestjs/swagger'
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateExtension {
  @ApiProperty({
    description: 'Extension name',
    example: '', // TODO: Add example
    maxLength: 255,
    minLength: 1,
    type: String,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  readonly name!: string

  @ApiProperty({
    default: null,
    description: 'Extension description',
    example: '', // Add example
    maxLength: 1024,
    minLength: 1,
    nullable: true,
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(1024)
  readonly description?: string | null

  @ApiProperty({
    default: 0,
    description: 'Extension price',
    example: 100,
    required: false,
    type: Number,
  })
  @IsNumber()
  @IsOptional()
  readonly price?: number

  @ApiProperty({
    default: [],
    description: 'Extension category ID',
    example: 1,
    required: false,
    type: Array<number>,
  })
  @IsOptional()
  readonly categoryID?: number
}
