<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FishingSession extends Model
{
    protected $fillable = ['order_id', 'fishing_spot_id', 'started_at', 'ends_at', 'blocks_count', 'status', 'expired_notified_at', 'completed_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ends_at' => 'datetime', 'expired_notified_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function fishingSpot(): BelongsTo
    {
        return $this->belongsTo(FishingSpot::class);
    }
}
