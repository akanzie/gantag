import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function お米券
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CASH_VOUCHER}
 * {@link TAGS.OTHER_COMPANY_CASH_COUPONS_NO_CHANGE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・お米券で支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内で他社金券（お米券）で支払ができる。
 * * * ・トラン保存確認
 * * \- t_payment
 * * \- t_payment_voucher
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/cart/voucher` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.お米券
 * * voucher_code: "0612"
 * * voucher_name: "お米券"
 * * change_type: 1 （お釣りなし）
 * * coupon_amount: 440
 * 
 * ---
 * ### 期待結果
 * * #### 2. 通常商品スキャン `/sales/cart/barcode`
 * * \- カート情報に通常商品が含まれていることを確認
 * * * \+ 通常商品バーコード：4500000000121
 * * #### 3. 小計 `/sales/subtotal`
 * * * \+ total_balance_amount = unit_price + unit_price * (tax_rate`/100`) = 400 + 400 * 8% = 432
 * * #### 4. 支払登録 `/sales/cart/voucher`
 * * * ライスクーポンで支払い（coupon_amount = 440）  
 * * \- 合計残高金額が0であることを確認
 * * \- ライスクーポンが適用されていることを確認
 * * * \+ payment:
 * * * * \.paid_cd = "0601"
 * * * * \.paid_name = "金券"
 * * * * \.voucher_cd = "0612"
 * * * * \.voucher_name = "お米券"
 * * * * \.paid_amount = coupon_amount
 * * #### 5. 取引完了 `/sales/end`
 * * \- レシートに支払方法「お米券」が含まれていることを確認
 * * #### 6. 売上ジャーナルトラン `/SalesData/tran/getdata`
 * * \- 取引が以下のテーブルにレシート番号（receipt_no）で保存されていることを確認
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_voucher
 */
export function TC_010741001_RiceCouponPayment() {
  group("TC_010741001 お米券", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const riceCouponAmount = 440; //Value of the rice coupon

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
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
        name: "Verify cart info has product 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.salesCartVoucher(step.payment, {
      cartNo,
      voucherCode: COUPON.RICE_VOUCHER.CD,
      voucherBalanceAmount: riceCouponAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount is 0",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify rice coupon have been applied",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER.PAID_NAME,
          voucherCd: COUPON.RICE_VOUCHER.CD,
          voucherName: COUPON.RICE_VOUCHER.NAME,
          paidAmount: riceCouponAmount,
        },
        actual: (res) => {
          const voucherPayment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER.PAID_CODE);
          return {
            paidCd: voucherPayment?.paid_cd,
            paidName: voucherPayment?.paid_name,
            voucherCd: voucherPayment?.voucher_cd,
            voucherName: voucherPayment?.voucher_name,
            paidAmount: voucherPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: お米券",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          COUPON.RICE_VOUCHER.NAME
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_voucher",
        expected: true,
        actual: (res) => res.result?.paymentVouchers?.length > 0,
      }),
    ]);
  });
}
