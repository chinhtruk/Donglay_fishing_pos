<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentQrSetting extends Model
{
    public const TYPE_CASH = 'cash';
    public const TYPE_QR = 'qr';

    protected $fillable = [
        'code',
        'name',
        'type',
        'sort_order',
        'is_enabled',
        'bank_name',
        'account_name',
        'account_number',
        'transfer_note',
        'extra_info',
        'qr_image_path',
    ];

    protected $appends = ['qr_image_url'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean'];
    }

    public function getQrImageUrlAttribute(): ?string
    {
        return $this->qr_image_path ? '/storage/'.ltrim($this->qr_image_path, '/') : null;
    }

    public static function current(): self
    {
        static::ensureDefaults();

        return static::query()
            ->where('type', self::TYPE_QR)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->firstOrCreate(
                ['code' => self::TYPE_QR],
                ['name' => 'QR chuyển khoản', 'type' => self::TYPE_QR, 'sort_order' => 10, 'is_enabled' => false]
            );
    }

    public function payload(): array
    {
        $type = $this->type ?: self::TYPE_QR;
        $code = $this->code ?: $type;
        $ready = $type === self::TYPE_CASH
            ? (bool) $this->is_enabled
            : (bool) $this->is_enabled && (bool) $this->qr_image_url;

        return [
            'id' => $this->id,
            'code' => $code,
            'name' => $this->name ?: ($type === self::TYPE_CASH ? 'Tiền mặt' : 'QR chuyển khoản'),
            'type' => $type,
            'is_enabled' => $ready,
            'is_ready' => $ready,
            'bank_name' => $this->bank_name,
            'account_name' => $this->account_name,
            'account_number' => $this->account_number,
            'transfer_note' => $this->transfer_note,
            'extra_info' => $this->extra_info,
            'qr_image_url' => $this->qr_image_url,
        ];
    }

    public function adminPayload(): array
    {
        $payload = $this->payload();

        return [
            ...$payload,
            'is_enabled' => (bool) $this->is_enabled,
            'is_ready' => $this->isReady(),
            'sort_order' => (int) ($this->sort_order ?? 0),
        ];
    }

    public function isReady(): bool
    {
        if (($this->type ?: self::TYPE_QR) === self::TYPE_CASH) {
            return (bool) $this->is_enabled;
        }

        return (bool) $this->is_enabled && (bool) $this->qr_image_url;
    }

    public static function ensureDefaults(): void
    {
        static::query()->whereNull('type')->update(['type' => self::TYPE_QR]);

        $qr = static::query()
            ->where(fn ($query) => $query->where('type', self::TYPE_QR)->orWhereNull('type'))
            ->orderBy('id')
            ->first();

        if ($qr) {
            $qr->forceFill([
                'code' => $qr->code ?: self::TYPE_QR,
                'name' => $qr->name ?: 'QR chuyển khoản',
                'type' => self::TYPE_QR,
                'sort_order' => $qr->sort_order ?? 10,
            ])->save();
        } else {
            static::query()->firstOrCreate(
                ['code' => self::TYPE_QR],
                ['name' => 'QR chuyển khoản', 'type' => self::TYPE_QR, 'sort_order' => 10, 'is_enabled' => false]
            );
        }

        static::query()->firstOrCreate(
            ['code' => self::TYPE_CASH],
            ['name' => 'Tiền mặt', 'type' => self::TYPE_CASH, 'sort_order' => 0, 'is_enabled' => true]
        );
    }

    public static function methodsPayload(bool $enabledOnly = false, bool $forAdmin = false): array
    {
        static::ensureDefaults();

        return static::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (self $method) => $forAdmin ? $method->adminPayload() : $method->payload())
            ->filter(fn (array $method) => ! $enabledOnly || $method['is_ready'])
            ->values()
            ->all();
    }

    public static function activeByCode(string $code): ?self
    {
        static::ensureDefaults();

        $method = static::query()
            ->where('code', $code)
            ->first();

        if ($method?->isReady()) {
            return $method;
        }

        if ($code === self::TYPE_QR) {
            return static::query()
                ->where('type', self::TYPE_QR)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->first(fn (self $candidate) => $candidate->isReady());
        }

        return null;
    }

    public static function nextCode(string $type): string
    {
        $base = $type === self::TYPE_CASH ? self::TYPE_CASH : self::TYPE_QR;
        if (! static::query()->where('code', $base)->exists()) {
            return $base;
        }

        for ($index = 2; $index < 100; $index++) {
            $candidate = "{$base}_{$index}";
            if (! static::query()->where('code', $candidate)->exists()) {
                return $candidate;
            }
        }

        return substr($base.'_'.time(), 0, 20);
    }
}
