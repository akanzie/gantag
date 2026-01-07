import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

// ｎ個ちょうどパターン
// ｎ個購入ごとにX円が成立する。
// 例）商品A～E（単価200円）3個で500円（100円の値引）
/**
 * @function ｎ個ちょうどパターン
ｎ個購入ごとにX円が成立する。
例）商品A～E（単価200円）3個で500円（100円の値引）
　　→　3個買うごとに500円（100円の値引）が成立
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.BUNDLE_MIX}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * ### テスト観点
 * * 前提：
 * * ミックスマッチｎ個ちょうどパターンの売上のレシート返品を行う。
 * * テスト観点：
 * * ミックスマッチの売上取引を返品して、ミックスマッチ適用後の金額が返金される。
 * * * ・商品A～Eは、販促_商品明細マスタに登録されている商品
 * * * * →　商品AとBでミックスマッチ成立 (合計500円のミックスマッチの商品1x2)
 * * * * 商品CとDでミックスマッチ成立 (合計500円のミックスマッチの商品1 + 合計500円のミックスマッチの商品2)
 * * * * 商品Eはミックスマッチ成立しない（まとめ値引対象商品A）
 * * * ・商品Fは、販促_商品明細マスタに登録されていない商品 (通常商品2)
 * * * * →　ミックスマッチとは関係ない商品で通常価格とな
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 合計500円のミックスマッチの商品1スキャン（1回目） | `/sales/cart/barcode` |
 * | 3 | 合計500円のミックスマッチの商品1スキャン（2回目） | `/sales/cart/barcode` |
 * | 4 | 合計500円のミックスマッチの商品1スキャン（3回目） | `/sales/cart/barcode` |
 * | 5 | 合計500円のミックスマッチの商品2 | `/sales/cart/barcode` |
 * | 6 | まとめ値引対象商品Aスキャン | `/sales/cart/barcode` |
 * | 7 | 通常商品2スキャン | `/sales/cart/barcode` |
 * | 8 | 小計 | `/sales/subtotal` |
 * | 9 | 支払登録 | `/sales/addpayment` |
 * | 10 | 取引完了 | `/sales/end` |
 * | 11 | 【返品】取引開始 | `/refund/begin` |
 * | 12 | 【返品】小計 | `/refund/subtotal` |
 * | 13 | 【返品】支払登録 | `/refund/addpayment` |
 * | 14 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * "ｎ個ちょうどパターン"のミックスマッチシナリオに対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.合計500円のミックスマッチの商品1 : 4500000000163
 * * 2.合計500円のミックスマッチの商品2 : 4500000000164
 * * 3.まとめ値引対象商品A : 4500000000112
 * * 4.通常商品2: 1050000011001
 * 
 * ---
 * ### 期待結果
 * * #### 8.小計 `/sales/subtotal`
 * * \- sales.total_balance_amountを確認
 * * #### 12. 【返品】小計   `/refund/subtotal`
 * * \- カート情報に以下の商品が存在する:
 * * * 合計500円のミックスマッチの商品1:
 * * * \+ barcode: 4500000000163
 * * * \+ unit_price: 400
 * * * \+ display_unit_price: 400
 * * * 合計500円のミックスマッチの商品1:
 * * * \+ barcode: 4500000000163
 * * * \+ unit_price: 400
 * * * \+ display_unit_price: 400
 * * * 合計500円のミックスマッチの商品1:
 * * * \+ barcode: 4500000000163
 * * * \+ unit_price: 400
 * * * \+ display_unit_price: 400
 * * * 合計500円のミックスマッチの商品2
 * * * \+ barcode: 4500000000164
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * * まとめ値引対象商品A
 * * * \+ barcode: 4500000000112
 * * * \+ unit_price: 300
 * * * \+ display_unit_price: 300
 * * * 通常商品2
 * * * \+ barcode: 1050000011001
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * \- カート情報のtotal_balance_amountを確認:
 * * * \+ total_balance_amount: 2484 ((items[0].unit_price + items[1].unit_price - まとめ値引き)+ (items[0].unit_price + items[1].unit_price - まとめ値引き) * 8% +  (items[2].unit_price + items[3].unit_price - まとめ値引き) + (items[2].unit_price + items[3].unit_price - まとめ値引き) * 8% + (items[4].unit_price + items[5].unit_price) + (items[4].unit_price + items[5].unit_price) * 8%)
 * * = (400 + 400 - 300) + 500 * 8%  + (400 + 200 - 100) + 500 * 8% + (300 + 1000) + 1300 * 8%
 * * * \+ total_balance_amount = sales.total_balance_amount
 * * \- カート情報の支払い方法を確認:
 * * * \+ payments.[].paid_group_cd= "0400"
 * * * \+ payments.[].paid_group_name = "バーコード決済"
 * * * \+ payments.[].paid_cd = "0412"
 * * * \+ payments.[].paid_name= "LINEPay"
 * * * \+ payments.[].paid_amount= total_balance_amount (Step 12で’計算した)
 * * #### 13. 【返品】支払登録 `/refund/addpayment`
 * * \- カー情報のvoid_paymentsを確認:
 * * * \+ payments.[].paid_group_cd= "0400"
 * * * \+ payments.[].paid_group_name = "バーコード決済"
 * * * \+ payments.[].paid_cd = "0412"
 * * * \+ payments.[].paid_name= "LINEPay"
 * * * \+ payments.[].paid_amount= total_balance_amount (Step 12で’計算した)
 * * #### 14. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が存在することを確認：
 * * * 合計500円のミックスマッチの商品1, 合計500円のミックスマッチの商品2, まとめ値引対象商品A, 通常商品2"
 */
export function TC_021937001_ExactlyNItemsPattern() {
  group("TC_021937001 ｎ個ちょうどパターン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeMixMatchTotal500Yen1First: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（1回目）"),
      barcodeMixMatchTotal500Yen1Second: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（2回目）"),
      barcodeMixMatchTotal500Yen1Third: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品1スキャン（3回目）"),
      barcodeMixMatchTotal500Yen2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "合計500円のミックスマッチの商品2"),
      barcodeMixMatchDiscountA: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "まとめ値引対象商品Aスキャン"),
      barcodeRegular2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品2スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1First, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1Second, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen1Third, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchTotal500Yen2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_TOTAL_500_YEN_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeMixMatchDiscountA, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MIX_MATCH_DISCOUNT_A,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: cartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 合計500円のミックスマッチの商品1",
        expected: () => {
          const item = cartInfo?.items?.[0];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[0];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 合計500円のミックスマッチの商品1",
        expected: () => {
          const item = cartInfo?.items?.[1];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[1];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 合計500円のミックスマッチの商品1",
        expected: () => {
          const item = cartInfo?.items?.[2];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[2];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 合計500円のミックスマッチの商品2",
        expected: () => {
          const item = cartInfo?.items?.[3];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[3];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has まとめ値引対象商品A",
        expected: () => {
          const item = cartInfo?.items?.[4];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[4];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 通常商品2",
        expected: () => {
          const item = cartInfo?.items?.[5];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[5];
          return {
            barCode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has total balance amount",
        expected: cartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has payment",
        expected:  {
          paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
          paidGroupName: PAID_METHOD.QRCODE.GROUP_NAME,
          paidCd: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
          paidName: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_NAME,
          paidAmount: cartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[0];
          return {
            paidGroupCode: payment?.paid_group_cd,
            paidGroupName: payment?.paid_group_name,
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has void_payments",
        expected: {
          paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
          paidGroupName: PAID_METHOD.QRCODE.GROUP_NAME,
          paidCd: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
          paidName: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_NAME,
          paidAmount: cartInfo.total_balance_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.[0];
          return {
            paidGroupCode: voidPayment?.paid_group_cd,
            paidGroupName: voidPayment?.paid_group_name,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt is printed correctly, contain information of item: 合計500円のミックスマッチの商品1, 合計500円のミックスマッチの商品2, まとめ値引対象商品A, 通常商品2",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.MIX_MATCH_TOTAL_500_YEN_1,
          PROD.MIX_MATCH_TOTAL_500_YEN_2,
          PROD.MIX_MATCH_DISCOUNT_A,
          PROD.REGULAR_2,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
