import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function りぴーと券を使用した売上の返品
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SALES}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.USE_REPEAT_TICKET}
 * ### テスト観点
 * * りぴーと券を使用した売上取引を返品して、りぴーと券適用後の金額が返金される。
 * * 取引①（前提）：発券
 * * * ・1000円以上の買い物を行う。
 * * * * →　商品A～Bの合計金額が1000円以上
 * * * ・30円分のりぴーと件が発券される。
 * * 取引②（前提）：りぴーと券を使用
 * * * ・支払登録画面でりぴーと券を1枚スキャンする。
 * * * * →　合計金額から30円値引される。
 * * 取引③（テスト）：取引②を返品する
 * * * ・レシート返品を行う。
 * * * * →　上記の売上取引レシートをスキャンする。
 * * 前提：
 * * りぴーと使用した売上のレシート返品を行う
 * * テスト観点：
 * * りぴーと券を使用した売上取引を返品して、りぴーと券適用後の金額が返金される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引①:前提（発券） | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 金券印字商品スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | - | => price: 1000 | - |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | - | 取引②:前提（金券利用） | - |
 * | 8 | 取引開始 | `/sales/begin` |
 * | 9 | ポイント対象商品（対象）スキャン | `/sales/cart/barcode` |
 * | 10 | 小計 | `/sales/subtotal` |
 * | 11 | りぴーと券スキャン（1枚） | `/sales/cart/barcode` |
 * | 12 | 支払登録 | `/sales/addpayment` |
 * | 13 | 取引完了 | `/sales/end` |
 * | - | 取引③:テスト（金券利用取引を返品） | - |
 * | 14 | 【返品】取引開始 | `/refund/begin` |
 * | 15 | 【返品】小計 | `/refund/subtotal` |
 * | 16 | 【返品】支払登録 | `/refund/addpayment` |
 * | 17 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * りぴーと券発券～利用シナリオを実行、利用シナリオに対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.りぴーと券: 
 * * バーコード１: トランザクション１に生成され
 * * バーコード２: トランザクション１に生成され
 * * 2.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 3.金券印字商品: 4911110703002
 * * 4.ポイント対象商品（対象）: 4520230413001
 * 
 * ---
 * ### 期待結果
 * * #### "11.りぴーと券スキャン（1枚）`/sales/cart/barcode`
 * * \- sales.cartinfoを確認
 * * * \+ total_balance_amount =  sales.cartinfo.total_balance_amount
 * * #### 15. 【返品】小計   `/refund/subtotal`
 * * \-カートInfoに以下のアイテムがあるか確認
 * * ポイント対象商品（対象）:
 * * * \+ barcode: 4520230413001
 * * * \+ unit_price: 150
 * * * \+ display_unit_price: 150
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment ) x quantity =  (150-0)x1 = 150
 * * \- カートInfo に total_balance_amountがあるか確認:
 * * * \+ total_balance_amount:  sales.total_balance_amount (total of total_statement_amount + total of total_statement_amount * 8% - 30= 150 + 150* 8% - 30= 132
 * * #### + total_balance_amount = total_balance_amount (Step 10.小計 `/sales/subtotal`でのtotal_balance_amount)
 * * #### 16. 【返品】支払登録 `/refund/addpayment`
 * * \- カートInfoに void_paymentsがあるか確認:
 * * \- りぴーと券
 * * * \+ payments.[].paid_group_cd= "0600"
 * * * \+ payments.[].paid_group_name = "金券
 * * * \+ payments.[].paid_cd = "0604"
 * * * \+ payments.[].paid_name= "りぴーと券"
 * * * \+ payments.[].paid_amount= 30
 * * \- LINEPay
 * * * \+ payments.[].paid_group_cd= "0400"
 * * * \+ payments.[].paid_group_name = "バーコード決済"
 * * * \+ payments.[].paid_cd = "0412"
 * * * \+ payments.[].paid_name= "LINEPay"
 * * * \+ payments.[].paid_amount= 132(total_balance_amountはステップ15にて計算した値)
 * * * \+ payments.[].paid_amount= 162(total_balance_amountはステップ15にて計算した値)
 * * #### 17. 【返品】取引完了 `/refund/end`
 * * \- レシートにポイント対象商品（対象）の情報があるか確認"
 */
export function TC_020839001_RefundItemHasRepeatVoucher() {
  group("TC_020839001 りぴーと券を使用した売上の返品", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeRepeatCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "金券印字商品スキャン"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      salesBegin2: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      salesSubtotal2: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcodeRepeat30yenCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "りぴーと券スキャン（1枚）"),
      salesPayment2: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      salesEnd2: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    // Test data
    const updatedPrice = 1000; // 金券印字商品とポイント対象商品（対象）の合計金額が1000円以上。30円分のりぴーと件が発券される。

    // Trans 1:
    let cartNo = TestHelper.salesBegin(step.salesBegin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeRepeatCoupon, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REPEAT_COUPON,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartChangeItemPrice(step.changePrice, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    let totalBalanceAmount = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.salesPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const voucher30yenPattern = /(30|38)\d{18}/g;

    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const voucher30yen = CommonFunction.getBarcodeData(salesEndResponse, voucher30yenPattern);
    const voucher30yenBarcode1 = voucher30yen?.barcodePart1;
    const voucher30yenBarcode2 = voucher30yen?.barcodePart2;
    // Trans 2:
    cartNo = TestHelper.salesBegin(step.salesBegin2, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cartInfo = TestHelper.salesSubtotal(step.salesSubtotal2, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const totalBalanceAmountDiscount = TestHelper.salesCartBarcode(step.barcodeRepeat30yenCoupon, {
      cartNo,
      barcodes: [
        {
          barcode: voucher30yenBarcode1,
          scan_data_type: "JAN13",
        },
        {
          barcode: voucher30yenBarcode2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.salesPayment2, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: totalBalanceAmountDiscount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponseTran2 = TestHelper.salesEnd(step.salesEnd2, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponseTran2.result?.receipt_no;
    const salesBusinessDay = salesEndResponseTran2.result?.business_day;

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
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has items: ポイント対象商品（対象）",
        expected: () => {
          const item = cartInfo?.items?.[0];
          return {
            barcode: item?.barcode,
            unit_price: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
            totalStatementAmount: item?.total_statement_amount,
          };
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[0];
          return {
            barcode: item?.barcode,
            unit_price: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
            totalStatementAmount: item?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has total balance amount",
        expected: cartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
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
        name: "Verify the cart info has void payments",
        expected: {
          paidGroupCd: PAID_METHOD.QRCODE.GROUP_CODE,
          paidGroupName: PAID_METHOD.QRCODE.GROUP_NAME,
          paidCd: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
          paidName: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_NAME,
          paidAmount: cartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment?.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          return {
            paidGroupCd: voidPayment?.paid_group_cd,
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
        name: "Verify receipt data must contain information: ポイント対象商品（対象）",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.POINT_TARGET,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
