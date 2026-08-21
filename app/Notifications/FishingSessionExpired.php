<?php

namespace App\Notifications;

use App\Models\FishingSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class FishingSessionExpired extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly FishingSession $session) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'fishing_session_expired',
            'title' => 'Phiên câu đã hết giờ',
            'message' => $this->session->fishingSpot->label.' đã đủ 4 giờ. Bạn có thể gia hạn hoặc thanh toán khi thuận tiện.',
            'order_id' => $this->session->order_id,
            'service_type' => 'fishing',
            'spot_id' => $this->session->fishing_spot_id,
            'session_id' => $this->session->id,
            'url' => '/pos/fishing?spot='.$this->session->fishing_spot_id,
        ];
    }
}
