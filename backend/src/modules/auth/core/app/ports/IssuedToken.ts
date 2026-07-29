/**
 * Token vừa được phát hành kèm thời điểm hết hạn, trả thẳng cho client.
 */
export default interface IssuedToken {
    token:     string;
    expiresAt: Date;
}
