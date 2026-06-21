<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = ['order_number', 'service_type', 'coffee_table_id', 'fishing_spot_id', 'opened_by', 'status', 'subtotal', 'total', 'version', 'completed_at', 'voided_at', 'void_reason'];

    protected function casts(): array
    {
        return ['subtotal' => 'decimal:2', 'total' => 'decimal:2', 'completed_at' => 'datetime', 'voided_at' => 'datetime'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function coffeeTable(): BelongsTo
    {
        return $this->belongsTo(CoffeeTable::class);
    }

    public function fishingSpot(): BelongsTo
    {
        return $this->belongsTo(FishingSpot::class);
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function fishingSession(): HasOne
    {
        return $this->hasOne(FishingSession::class);
    }
}
