<?php

use App\Services\FishingSessionExpirationNotifier;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function (): void {
    app(FishingSessionExpirationNotifier::class)->sync();
})->name('expire-fishing-sessions')->everyMinute()->withoutOverlapping();
