<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class PosEventNotification extends Notification
{
    public function __construct(
        private readonly string $title,
        private readonly string $message,
        private readonly string $url,
        private readonly string $type = 'pos_event',
        private readonly array $meta = []
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
            'message' => $this->message,
            'url' => $this->url,
            ...$this->meta,
        ];
    }
}
