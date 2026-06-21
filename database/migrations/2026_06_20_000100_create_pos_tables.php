<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_challenges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('coffee_tables', function (Blueprint $table) {
            $table->id();
            $table->string('label', 50);
            $table->decimal('position_x', 5, 2)->default(50);
            $table->decimal('position_y', 5, 2)->default(50);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('fishing_spots', function (Blueprint $table) {
            $table->id();
            $table->string('label', 50);
            $table->decimal('position_x', 5, 2)->default(50);
            $table->decimal('position_y', 5, 2)->default(50);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->string('category', 80)->index();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->decimal('price', 14, 2);
            $table->boolean('is_available')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 32)->unique();
            $table->string('service_type', 20)->index();
            $table->foreignId('coffee_table_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('fishing_spot_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('opened_by')->constrained('users')->restrictOnDelete();
            $table->string('status', 30)->default('open')->index();
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestamps();
            $table->index(['service_type', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_item_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('line_type', 30)->default('menu');
            $table->string('name_snapshot', 160);
            $table->decimal('unit_price', 14, 2);
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('paid_quantity')->default(0);
            $table->timestamps();
        });

        Schema::create('fishing_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('fishing_spot_id')->constrained()->restrictOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ends_at')->index();
            $table->unsignedInteger('blocks_count')->default(1);
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('expired_notified_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number', 32)->unique();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete();
            $table->string('method', 20)->default('cash');
            $table->decimal('amount', 14, 2);
            $table->decimal('cash_received', 14, 2);
            $table->decimal('change_due', 14, 2)->default(0);
            $table->string('status', 20)->default('completed')->index();
            $table->timestamp('paid_at');
            $table->timestamps();
        });

        Schema::create('payment_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->restrictOnDelete();
            $table->foreignId('order_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('amount', 14, 2);
            $table->timestamps();
        });

        Schema::create('payment_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->text('reason');
            $table->timestamp('created_at');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 80)->index();
            $table->string('auditable_type', 120);
            $table->unsignedBigInteger('auditable_id');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('created_at');
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('payment_adjustments');
        Schema::dropIfExists('payment_lines');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('fishing_sessions');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('fishing_spots');
        Schema::dropIfExists('coffee_tables');
        Schema::dropIfExists('otp_challenges');
    }
};
