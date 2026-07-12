<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class DatabaseBackupMail extends Mailable
{
    public function __construct(
        public readonly string $backupPath,
        public readonly string $backupName,
        public readonly bool $beforeReset = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->beforeReset
            ? 'Bản sao lưu trước khi xóa dữ liệu Đồng lầy Fishing'
            : 'Bản sao lưu database Đồng lầy Fishing');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.database-backup');
    }

    public function attachments(): array
    {
        return [
            Attachment::fromPath($this->backupPath)
                ->as($this->backupName)
                ->withMime('application/sql'),
        ];
    }
}
