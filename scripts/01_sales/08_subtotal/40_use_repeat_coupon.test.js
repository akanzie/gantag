import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 発券～使用（異常系）
Ticketing ~ Use (abnormal system)
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_REPEAT_TICKET}
 * {@link TAGS.VALIDITY_PERIOD_CHECK}
 * ### テスト観点
 * * 利用期間外のりぴーと券を使用してエラー表示される
 * * 前提：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　商品A
 * * * ・m_store_itemにpoint_apply_type_1が9:（上位参照）→　商品B
 * * * ・金券印字商品（売価変更後の売価）が1000円以上であること。
 * * * ・m_voucherにりぴーと券が設定されている
 * * * ・m_voucherのstart_datetime～end_datetimeが利用期間外となっていること。　
 * * * ・m_paymentにりぴーと券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * テスト観点：
 * * * ・りぴーと券が利用期間外のためりぴーと券をスキャンするとエラーになる。
 * * "エラーメッセージ": "この金券は現在利用できません（利用期間終了）",
 * * "エラーコード": "VUC0003",
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 金券印字商品スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | - | => price: 1000 | - |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 利用期間外のりぴーと券スキャン | `/sales/cart/barcode` |
 * | - | →　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * 1.りぴーと券（利用期間外）が以下通り設定される：
 * * m_voucher.start_datetime = "2016-05-02 00:00:00.000000"
 * * m_voucher.end_datetime = "2022-06-30 00:00:00.000000"
 * 
 * ---
 * ### テストデータ
 * * 1.りぴーと券: 
 * * バーコード 1: 30149202306279990018
 * * バーコード 2: 38008001251002000019
 * * 2.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 3.金券印字商品: 4911110703002
 * 
 * ---
 * ### 期待結果
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードのスキャンを確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 4.売価変更 `/sales/cart/changeitemprice`
 * * \- Cart Info にて１つの商品があるか確認
 * * * \+金券印字商品:
 * * * \++ barcode:  4911110703002
 * * * \++ quantity: 1
 * * * \++ unit_price:  17511
 * * * \++ display_unit_price: 1000
 * * * \++ total_statement_amount: 1000
 * * * \++ subtotal_discount_apportionment: 0
 * * * \++ rax_rate: 10
 * * \- 以下が正しいか確認
 * * total_sales_amount: 1100 = 1000+1000*10%
 * * #### 6.利用期間外のりぴーと券スキャン`/sales/cart/barcode`
 * *  りぴーと券（利用期間外）を利用する時、エラーメッセージとエラーコードを確認
 * * * \+ エラーメッセージ: "この金券は現在利用できません（利用期間終了）"
 * * * \+ エラーコード: VUC0003
 */
export function TC_010840002_ReleaseAndUseRepeatVoucher_Abnormal() {
  group("TC_010840002 発券～使用（異常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeRepeatCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "金券印字商品スキャン"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcodeRepeat30yenExpCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "利用期間外のりぴーと券スキャン"),
    };

    // Test data
    const voucher30yenBarcodeExp1 = "30149202306279990018";
    const voucher30yenBarcodeExp2 = "38008001251002000019";
    const updatedPrice = 1000; // Request data for the price change API

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
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
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
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
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRepeat30yenExpCoupon, {
      cartNo,
      barcodes: [
        {
          barcode: voucher30yenBarcodeExp1,
          scan_data_type: "JAN13",
        },
        {
          barcode: voucher30yenBarcodeExp2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("VUC0003", "この金券は現在利用できません（利用期間終了）"),
    ]);
  });
}

/**
 * @function 発券～使用（正常系）
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_REPEAT_TICKET}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * りぴーと券をスキャンして割引が適用される
 * * * ・1000円以上の買い物を行う。
 * * * * →　金券印字商品とポイント対象商品（対象）の合計金額が1000円以上
 * * * ・30円分のりぴーと件が発券される。
 * * * ・支払登録画面でりぴーと券を1枚スキャンする。
 * * * * →　合計金額から30円値引される。
 * * 前提：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　ポイント対象商品（対象）
 * * * ・m_store_itemにpoint_apply_type_1が9:（上位参照）→　金券印字商品
 * * * ・金券印字商品とポイント対象商品（対象）の合計が1000円以上であること。
 * * * ・m_voucherにりぴーと券が設定されている
 * * * ・m_paymentにりぴーと券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * テスト観点：
 * * 取引①
 * * * ・売上合計額が1000円以上で30円分のりぴーと券が発券される。
 * * 取引②
 * * * ・りぴーと券を即時利用ができる。
 * * * ・りぴーと券を利用した分、合計金額から値引される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引１ | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | 金券印字商品スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | - | => price: 1000 | - |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | - | 取引２ | - |
 * | 8 | 取引開始 | `/sales/begin` |
 * | 9 | ポイント対象商品（対象）スキャン | `/sales/cart/barcode` |
 * | 10 | 小計 | `/sales/subtotal` |
 * | 11 | りぴーと券スキャン（1枚） | `/sales/cart/barcode` |
 * | 12 | 支払登録 | `/sales/addpayment` |
 * | 13 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 1.りぴーと券: トラン１で発行
 * * \- バーコード 1 ：prefix が 30, 文字長２０文字
 * * \- バーコード2：prefix が 38, 文字長２０文字
 * 
 * ---
 * ### テストデータ
 * * 1.りぴーと券: 
 * * バーコード１: トラン１に生成される
 * * バーコード２: トラン１に生成される
 * * 2.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 3.金券印字商品: 4911110703002
 * * 4.ポイント対象商品（対象）: 4520230413001
 * 
 * ---
 * ### 期待結果
 * * 取引１:
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードのスキャンを確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 4.売価変更 `/sales/cart/changeitemprice`
 * * \- 合計金額 :
 * * * \+ total_sales_amount: 1100  (total_sale_amount = unit_prite +  unit_prite*tax_rate =1000 + 1000 * 10%) > 1000
 * * #### 7.取引完了 `/sales/end`
 * * \- りぴーと券の発行を確認（XMLに30円券の情報があるか確認）
 * * 取引２:
 * * #### 11.りぴーと券スキャン（1枚）`/sales/cart/barcode`
 * * \- payments内のりぴーと券の情報を確認:
 * * * \+ payments.[].paid_group_cd= "0600"
 * * * \+ payments.[].paid_group_name = "金券"
 * * * \+ payments.[].paid_cd = "0604"
 * * * \+ payments.[].paid_name= "りぴーと券"
 * * * \+ payments.[].paid_amount= 30
 * * \- 合計金額から30円券が適用されたか確認
 * * * \+ total_sales_amount = 162
 * * * \+ total_balance_amount =  132
 * * * \+ total_sales_amount - total_balance_amount  = 30
 */
export function TC_010840001_ReleaseAndUseRepeatVoucher() {
  group("TC_010840001 発券～使用（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeRepeatCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "金券印字商品スキャン"),
      changePrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      begin2: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      subtotal2: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcodeRepeat30yenCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "りぴーと券スキャン（1枚）"),
      payment2: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      end2: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
    };

    const voucher30yenPattern = /(30|38)\d{18}/g;
    // Test data
    const updatedPrice = 1000; // 金券印字商品とポイント対象商品（対象）の合計金額が1000円以上。30円分のりぴーと件が発券される。
    let voucher30yenBarcode1 = null;
    let voucher30yenBarcode2 = null;
    const paidAmountVoucher30yen = 30;

    // Trans 1:
    let cartNo = TestHelper.salesBegin(step.begin, {}, [
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
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
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
      CHECK.createEqualsCheck({
        name: "Verify total_sales_amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]);

    let totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 1 りぴーと券 has been created (xml contain a ３０円券)",
        expected: true,
        actual: (res) => {
          const voucher30yen = CommonFunction.getBarcodeData(res, voucher30yenPattern);
          voucher30yenBarcode1 = voucher30yen?.barcodePart1;
          voucher30yenBarcode2 = voucher30yen?.barcodePart2;
          return voucher30yenBarcode1 != null && voucher30yenBarcode2 != null;
        },
      }),
    ]);

    // Trans 2:
    cartNo = TestHelper.salesBegin(step.begin2, {}, [
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

    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal2, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesCartBarcode(step.barcodeRepeat30yenCoupon, {
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
      CHECK.createEqualsCheck({
        name: "Verify りぴーと券 payment has been applied",
        expected: {
          paidGroupCd: PAID_METHOD.VOUCHER.GROUP_CODE,
          paidGroupName: PAID_METHOD.VOUCHER.GROUP_NAME,
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.REPEAT_COUPON.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.REPEAT_COUPON.PAID_NAME,
          paidAmount: paidAmountVoucher30yen,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[0];
          return {
            paidGroupCd: payment?.paid_group_cd,
            paidGroupName: payment?.paid_group_name,
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify that the amount of ３０円 has been deducted from the total balance amount",
        expected: (res) => {
          const totalBalanceAmount = Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items, paidAmountVoucher30yen);
          const totalSalesAmount = Formular.calcTotalSalesAmount(res.result?.cartinfo?.items);
          return totalBalanceAmount === totalSalesAmount - paidAmountVoucher30yen;
        },
        actual: (res) => res.result?.cartinfo?.total_balance_amount === res.result?.cartinfo?.total_sales_amount - paidAmountVoucher30yen,
      }),
    ]);

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
