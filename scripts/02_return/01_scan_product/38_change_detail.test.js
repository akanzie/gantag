import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 一連の返品登録（単品返品）・商品明細取消・売価変更
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.CHANGE_DETAILS}
 * {@link TAGS.RETURN_RECEIPT}
 * {@link TAGS.DELETE_DETAILS}
 * {@link TAGS.SELLING_PRICE_CHANGE}
 * ### テスト観点
 * * 前提：
 * * * ・単品返品をスキャンする。
 * * * * →　上記の売上取引で購入した商品A～Cをスキャンする。
 * * * ・商品明細の変更と削除
 * * * * →　商品A：商品明細削除  →　ポイント対象商品（上位参照）
 * * * * 商品B：売価変更　→　通常商品2
 * * * * 商品C：操作無し
 * * テスト観点：
 * * 単品返品時に明細の取消・変更の一連動作が出来ることを確認する。
 * * 一連操作：商品明細取消、売価変更、数量変更
 * * * ・小計では商品BCしかない。
 * * * ・商品Bは売価が変更された金額になっている。
 * * * ・取引完了にはレシートnoが確認できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | ポイント対象商品（上位参照）スキャン | `/refund/cart/barcode` |
 * | 3 | 通常商品2スキャン | `/refund/cart/barcode` |
 * | 4 | '通常商品スキャン | `/refund/cart/barcode` |
 * | 5 | 【返品】商品明細削除 | `/refund/cart/deleteitem` |
 * | 6 | 【返品】売価変更 | `/refund/changeitemprice` |
 * | 7 | 【返品】小計 | `/refund/subtotal` |
 * | 8 | 【返品】支払登録 | `/refund/addpayment` |
 * | 9 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. ポイント対象商品（上位参照）: 4500000000056
 * * 2. 通常商品2: 1050000011001
 * * 3. '通常商品: 4500000000121
 * * 4. Price: 100
 * 
 * ---
 * ### 期待結果
 * * #### 2. ポイント対象商品（上位参照）スキャン `/refund/cart/barcode`
 * * \- カート情報に商品が存在する「 ポイント対象商品（上位参照）」:
 * * * \+ barcode: 4500000000056
 * * #### 3. 通常商品2スキャン `/refund/cart/barcode`
 * * \- カート情報に商品が存在する「通常商品2」:
 * * * \+ barcode: 1050000011001
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * #### 4. 通常商品スキャン `/refund/cart/barcode`
 * * \- カート情報に商品が存在する「通常商品」:
 * * * \+ barcode: 4500000000121
 * * * \+ quantity: 1
 * * #### 5.【返品】商品明細削除 `/refund/cart/deleteitem`　→ ポイント対象商品（上位参照）
 * * \- カート情報に商品が存在しない：「ポイント対象商品（上位参照)」
 * * \- カート情報に商品が存在する: 「通常商品2」と「通常商品」:
 * * * \+ 通常商品2: 1050000011001
 * * * \+ 通常商品: 4500000000121
 * * #### 6.【返品】売価変更 `/refund/changeitemprice`　→　通常商品2
 * * \- 「通常商品2」の売価が変更されること
 * * * \+ barcode: 1050000011001
 * * * \+ display_unit_price: 100 (equal request body: price)
 * * #### 9.【返品】取引完了 `/refund/end`
 * * \- レシートに商品が含まれること 「通常商品2」と「通常商品」:
 * * * \+ 1050000011001, 4500000000121
 */
export function TC_020138001_RefundByReceiptProductNormal() {
  group("TC_020138001 一連の返品登録（単品返品）・商品明細取消・売価変更・数量変更", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "通常商品2スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "通常商品スキャン"),
      deleteItem: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_DELETE_ITEM, "【返品】商品明細削除"),
      changeItemPrice: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_CHANGE_ITEM_PRICE),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

   
    const refundType = 1; // Refund item
    const regular2Price = 1000; // Specified in master
    // Generate price to a new price (non-zero and difference current price)
    const updatedPrice = Math.floor(Math.random() * (regular2Price - 1)) + 1;

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has ポイント対象商品（上位参照）",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.POINT_TARGET_REFER_UPPER,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.refundCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 通常商品2",
        expected: {
          barcode: PROD.REGULAR_2,
          displayUnitPrice: regular2Price,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.REGULAR_2);
          return {
            barcode: item?.barcode,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
    ]);

    TestHelper.refundCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.refundCartDeleteItem(step.deleteItem, {
      cartNo,
      statementNo: 0,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has no contain item ポイント対象商品（上位参照）",
        expected: false,
        actual: (res) => CommonFunction.hasItems([
          PROD.POINT_TARGET_REFER_UPPER,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesCartChangeItemPrice(step.changeItemPrice, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the price of item 通常商品2 has been changed",
        expected: {
          barcode: PROD.REGULAR_2,
          display_unit_price: updatedPrice,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.REGULAR_2);
          return {
            barcode: item?.barcode,
            display_unit_price: item?.display_unit_price,
          };
        },
      }),
    ]);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info only has 2 item: 通常商品2 and 通常商品",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains item 通常商品2",
        expected: {
          barcode: PROD.REGULAR_2,
          displayUnitPrice: updatedPrice,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.REGULAR_2);
          return {
            barcode: item?.barcode,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains item 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalBalanceAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 通常商品2 and 通常商品",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR_2,
          PROD.REGULAR,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has exist receipt no (receipt_no > 0)",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}
