<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminDataController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => auth()->check() ? redirect(auth()->user()->isAdmin() ? '/admin/dashboard' : '/pos/coffee') : redirect('/login'));
Route::view('/login', 'auth.login')->name('login');

Route::middleware('auth')->group(function () {
    Route::view('/pos/{section?}', 'app')->where('section', 'coffee|fishing|orders')->middleware('role:admin,employee');
    Route::view('/admin/{section?}', 'app')->where('section', 'dashboard|menu|map|users|orders|settings|data')->middleware('role:admin');
});

Route::prefix('api/v1')->group(function () {
    Route::middleware('throttle:8,1')->group(function () {
        Route::post('/auth/admin', [AuthController::class, 'adminLogin']);
        Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
        Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
    });

    Route::middleware('auth')->group(function () {
        Route::get('/profile', [AuthController::class, 'profile']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('/notifications/delete-all', [NotificationController::class, 'deleteAll']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'read']);

        Route::middleware('role:admin,employee')->group(function () {
            Route::get('/coffee/map', [PosController::class, 'coffeeMap']);
            Route::post('/coffee/orders', [PosController::class, 'createCounterCoffee']);
            Route::post('/coffee/tables/{coffeeTable}/orders', [PosController::class, 'createCoffee']);
            Route::put('/coffee/orders/{order}', [PosController::class, 'updateCoffee']);
            Route::put('/coffee/orders/{order}/table', [PosController::class, 'assignCoffeeTable']);
            Route::post('/coffee/orders/{order}/checkout', [PosController::class, 'coffeeCheckout']);
            Route::post('/coffee/orders/{order}/merge', [PosController::class, 'mergeCoffee']);
            Route::post('/coffee/orders/{order}/release', [PosController::class, 'releaseCoffee']);
            Route::get('/fishing/map', [PosController::class, 'fishingMap']);
            Route::post('/fishing/spots/{fishingSpot}/start', [PosController::class, 'startFishing']);
            Route::post('/fishing/orders/{order}/extend', [PosController::class, 'extendFishing']);
            Route::post('/fishing/orders/{order}/discount', [PosController::class, 'updateFishingDiscount']);
            Route::put('/fishing/orders/{order}', [PosController::class, 'updateFishing']);
            Route::post('/fishing/orders/{order}/merge', [PosController::class, 'mergeFishing']);
            Route::post('/fishing/orders/{order}/checkout', [PosController::class, 'fishingCheckout']);
            Route::post('/fishing/orders/{order}/release', [PosController::class, 'releaseFishing']);
            Route::get('/orders', [OrderController::class, 'index']);
            Route::get('/orders/{order}', [PosController::class, 'order']);
        });

        Route::prefix('admin')->middleware('role:admin')->group(function () {
            Route::get('/dashboard', [AdminController::class, 'dashboard']);
            Route::get('/menu', [AdminController::class, 'menu']);
            Route::post('/menu', [AdminController::class, 'storeMenu']);
            Route::post('/menu/batch', [AdminController::class, 'storeMenuBatch']);
            Route::put('/menu/{menuItem}', [AdminController::class, 'updateMenu']);
            Route::delete('/menu/{menuItem}', [AdminController::class, 'deleteMenu']);
            Route::get('/map', [AdminController::class, 'map']);
            Route::put('/map', [AdminController::class, 'updateMap']);
            Route::post('/map', [AdminController::class, 'storeMapSlot']);
            Route::delete('/map/{type}/{id}', [AdminController::class, 'deleteMapSlot']);
            Route::get('/payment-settings', [AdminController::class, 'paymentSettings']);
            Route::post('/payment-settings', [AdminController::class, 'updatePaymentSettings']);
            Route::post('/payment-methods', [AdminController::class, 'storePaymentMethod']);
            Route::post('/payment-methods/{paymentMethod}', [AdminController::class, 'updatePaymentMethod']);
            Route::put('/payment-methods/{paymentMethod}', [AdminController::class, 'updatePaymentMethod']);
            Route::get('/data', [AdminDataController::class, 'show']);
            Route::post('/data/backup', [AdminDataController::class, 'backup'])->middleware('throttle:2,10');
            Route::post('/data/backup-and-clear', [AdminDataController::class, 'backupAndClear'])->middleware('throttle:2,10');
            Route::get('/users', [AdminController::class, 'users']);
            Route::post('/users', [AdminController::class, 'storeUser']);
            Route::put('/users/{user}', [AdminController::class, 'updateUser']);
            Route::post('/orders/{order}/void', [AdminController::class, 'voidOrder']);
            Route::post('/payments/{payment}/reverse', [AdminController::class, 'reversePayment']);
        });
    });
});
