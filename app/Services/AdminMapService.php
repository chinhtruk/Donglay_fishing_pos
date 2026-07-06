<?php

namespace App\Services;

use App\Http\Requests\Api\Admin\StoreMapSlotRequest;
use App\Http\Requests\Api\Admin\UpdateMapRequest;
use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMapService
{
    public function __construct(private readonly AdminAuditLogger $audit)
    {
    }

    public function payload(): array
    {
        $tables = CoffeeTable::orderBy('id')->get()->map(function (CoffeeTable $table) {
            $order = $table->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();

            return [
                'id' => $table->id,
                'label' => $table->label,
                'position_x' => $table->position_x,
                'position_y' => $table->position_y,
                'is_enabled' => $table->is_enabled,
                'state' => ! $table->is_enabled ? 'disabled' : ($order ? 'occupied' : 'available'),
                'order' => $order ? OrderPresenter::make($order) : null,
            ];
        });

        $spots = FishingSpot::orderBy('id')->get()->map(function (FishingSpot $spot) {
            $order = $spot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();
            $session = $order?->fishingSession;
            $isExpired = $session && ($session->ends_at?->isPast() || $session->status === 'expired');

            return [
                'id' => $spot->id,
                'label' => $spot->label,
                'position_x' => $spot->position_x,
                'position_y' => $spot->position_y,
                'is_enabled' => $spot->is_enabled,
                'state' => ! $spot->is_enabled ? 'disabled' : (! $order ? 'available' : ($isExpired ? 'expired' : 'occupied')),
                'order' => $order ? OrderPresenter::make($order) : null,
            ];
        });

        return ['tables' => $tables, 'spots' => $spots];
    }

    public function update(UpdateMapRequest $request): void
    {
        $data = $request->validated();
        $model = $this->modelFor($data['type']);

        DB::transaction(function () use ($model, $data, $request) {
            foreach ($data['slots'] as $slotData) {
                $slot = $model::lockForUpdate()->findOrFail($slotData['id']);
                $before = $slot->toArray();
                $slot->update($slotData);
                $this->audit->record($request->user(), 'map.updated', $slot, $before, $slot->fresh()->toArray());
            }
        });
    }

    public function createSlot(StoreMapSlotRequest $request): CoffeeTable|FishingSpot
    {
        $data = $request->validated();
        $model = $this->modelFor($data['type']);

        $slot = $model::create([
            'label' => $data['label'],
            'position_x' => 50,
            'position_y' => 50,
            'is_enabled' => $data['is_enabled'] ?? true,
        ]);

        $this->audit->record($request->user(), 'map.created', $slot, null, $slot->toArray());

        return $slot;
    }

    public function deleteSlot(Request $request, string $type, int $id): void
    {
        $model = $this->modelFor($type);
        $slot = $model::findOrFail($id);

        $hasActiveOrders = $slot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->exists();
        if ($hasActiveOrders) {
            throw ValidationException::withMessages(['slot' => 'Vị trí này đang có hóa đơn hoạt động, không thể xóa lúc này.']);
        }

        $before = $slot->toArray();
        $slot->delete();

        $this->audit->record($request->user(), 'map.deleted', $slot, $before, null);
    }

    private function modelFor(string $type): string
    {
        return match ($type) {
            'coffee' => CoffeeTable::class,
            'fishing' => FishingSpot::class,
            default => abort(400, 'Invalid type'),
        };
    }
}
