import { NestFactory } from '@nestjs/core';
import { K8sGeneratorModule } from './k8s-generator.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(K8sGeneratorModule);
  app.enableCors();
  
  const port = process.env.K8S_GENERATOR_PORT || 3020;
  const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';

  // Connect Kafka microservice for consuming events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'k8s-generator',
        brokers: kafkaBroker.split(','),
      },
      consumer: {
        groupId: 'k8s-generator-group',
        allowAutoTopicCreation: true,
      },
    },
  });

  // Start all microservices + HTTP
  await app.startAllMicroservices();
  await app.listen(port);
  
  console.log(`✅ K8s Generator Service | HTTP: http://localhost:${port} | Kafka: listening`);
}
bootstrap();
