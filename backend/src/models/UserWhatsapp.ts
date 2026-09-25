import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class UserWhatsapp extends Model<UserWhatsapp> {
  @ForeignKey(() => User)
  @Column
  userId: number;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;
}

export default UserWhatsapp;
