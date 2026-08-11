import { PartialType } from '@nestjs/swagger';
import { CreateVehicleListingDto } from './create-vehicle-listing.dto';

export class UpdateVehicleListingDto extends PartialType(CreateVehicleListingDto) {}
