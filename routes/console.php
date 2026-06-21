<?php

use App\Models\FishingSession;
use App\Models\User;
use App\Notifications\FishingSessionExpired;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function (): void {
    FishingSession::query()
        ->where('status', 'active')
        ->whereNull('expired_notified_at')
        ->where('ends_at', '<=', now())
        ->with('fishingSpot')
        ->each(function (FishingSession $session): void {
            DB::transaction(function () use ($session): void {
                $locked = FishingSession::lockForUpdate()->find($session->id);
                if (! $locked || $locked->expired_notified_at || $locked->status !== 'active') {
                    return;
                }
                $locked->update(['status' => 'expired', 'expired_notified_at' => now()]);
                $locked->load('fishingSpot');
                Notification::send(User::where('is_active', true)->get(), new FishingSessionExpired($locked));
            });
        });
})->name('expire-fishing-sessions')->everyMinute()->withoutOverlapping();
