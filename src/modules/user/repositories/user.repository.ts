import { Prisma, Provider, User } from '@prisma/client';

export class UserRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.tx.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.tx.user.findUnique({ where: { id } });
  }

  async findByProviderId(providerId: string): Promise<User | null> {
    return this.tx.user.findFirst({ where: { providerId } });
  }

  async create(data: {
    email: string;
    password?: string;
    name?: string;
    provider?: Provider;
    providerId?: string;
    avatar?: string;
    pendingStripeSetup?: boolean;
  }): Promise<User> {
    return this.tx.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.tx.user.update({
      where: { id },
      data,
    });
  }

  async findAll(): Promise<User[]> {
    return this.tx.user.findMany();
  }
}
