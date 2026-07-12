<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    public const POS_OPERATIONAL_RESET_HOUR = 23;

    public const POS_OPERATIONAL_RESET_MINUTE = 59;

    protected $fillable = ['order_number', 'service_type', 'coffee_table_id', 'fishing_spot_id', 'opened_by', 'status', 'subtotal', 'total', 'version', 'completed_at', 'voided_at', 'void_reason'];

    protected function casts(): array
    {
        return ['subtotal' => 'decimal:2', 'total' => 'decimal:2', 'completed_at' => 'datetime', 'voided_at' => 'datetime'];
    }

    public static function currentPosOperationalWindow(?CarbonInterface $now = null): array
    {
        $moment = ($now ?? now())->copy();
        $resetAt = $moment->copy()->setTime(self::POS_OPERATIONAL_RESET_HOUR, self::POS_OPERATIONAL_RESET_MINUTE);

        if ($moment->greaterThanOrEqualTo($resetAt)) {
            $startAt = $resetAt->copy();
            $resetAt = $resetAt->copy()->addDay();
        } else {
            $startAt = $resetAt->copy()->subDay();
        }

        return [$startAt, $resetAt];
    }

    public static function posOperationalPayload(?CarbonInterface $now = null): array
    {
        [$startAt, $resetAt] = self::currentPosOperationalWindow($now);

        return [
            'starts_at' => $startAt->toIso8601String(),
            'resets_at' => $resetAt->toIso8601String(),
        ];
    }

    public static function isPosOperationalClosingMinute(?CarbonInterface $now = null): bool
    {
        $moment = $now ?? now();

        return $moment->hour === self::POS_OPERATIONAL_RESET_HOUR
            && $moment->minute === self::POS_OPERATIONAL_RESET_MINUTE;
    }

    public function scopeForCurrentPosOperationalDay(Builder $query): Builder
    {
        [$startAt, $resetAt] = self::currentPosOperationalWindow();

        return $query
            ->where($this->qualifyColumn('created_at'), '>=', $startAt)
            ->where($this->qualifyColumn('created_at'), '<', $resetAt);
    }

    public function scopeActiveForPos(Builder $query): Builder
    {
        return $query
            ->forCurrentPosOperationalDay()
            ->whereNull($this->qualifyColumn('completed_at'))
            ->where($this->qualifyColumn('status'), '!=', 'void');
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
