<?php

namespace App\Services;

use App\Models\FishingSession;
use App\Models\User;
use App\Notifications\FishingSessionExpired;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class FishingSessionExpirationNotifier
{
    public function sync(): int
    {
        $notified = 0;

        FishingSession::query()
            ->where('status', 'active')
            ->whereNull('expired_notified_at')
            ->where('ends_at', '<=', now())
            ->with('fishingSpot')
            ->each(function (FishingSession $session) use (&$notified): void {
                DB::transaction(function () use ($session, &$notified): void {
                    $locked = FishingSession::lockForUpdate()->find($session->id);
                    if (! $locked || $locked->expired_notified_at || $locked->status !== 'active') {
                        return;
                    }

                    $locked->update(['status' => 'expired', 'expired_notified_at' => now()]);
                    $locked->load('fishingSpot');
                    $notification = new FishingSessionExpired($locked);
                    User::activePosNotifiable()->chunkById(100, function ($users) use ($notification): void {
                        Notification::send($users, $notification);
                    });
                    $notified++;
                });
            });

        return $notified;
    }
}
