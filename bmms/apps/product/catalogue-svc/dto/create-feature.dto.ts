export class CreateFeatureDto {
  name: string;
  description: string;
  code: string; // Unique identifier like 'api_access', 'storage_limit'
}